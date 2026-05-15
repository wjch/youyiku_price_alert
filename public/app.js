const form = document.querySelector("#productForm");
const list = document.querySelector("#productList");
const statusText = document.querySelector("#statusText");
const checkNowButton = document.querySelector("#checkNow");

await refresh();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    const response = await fetch("/api/products", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: formData.get("url"),
        name: formData.get("name")
      })
    });

    await ensureOk(response);
    form.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

checkNowButton.addEventListener("click", async () => {
  checkNowButton.disabled = true;

  try {
    const response = await fetch("/api/check", {
      method: "POST"
    });
    await ensureOk(response);
    statusText.textContent = "已开始检查，稍后自动刷新。";
    setTimeout(refresh, 5000);
  } catch (error) {
    alert(error.message);
  } finally {
    checkNowButton.disabled = false;
  }
});

list.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) {
    return;
  }

  const confirmed = confirm(`删除「${button.dataset.deleteName}」的监控？`);
  if (!confirmed) {
    return;
  }

  button.disabled = true;
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(button.dataset.deleteId)}`, {
      method: "DELETE"
    });
    await ensureOk(response);
    await refresh();
  } catch (error) {
    alert(error.message);
    button.disabled = false;
  }
});

async function refresh() {
  const response = await fetch("/api/products");
  const data = await ensureOk(response);

  statusText.textContent = data.running ? "正在检查价格..." : `共 ${data.products.length} 个商品`;
  renderProducts(data.products);
}

function renderProducts(products) {
  if (products.length === 0) {
    list.innerHTML = '<div class="empty">还没有商品，粘贴优衣库商品链接后开始监控。</div>';
    return;
  }

  list.replaceChildren(
    ...products.map((product) => {
      const item = document.createElement("article");
      item.className = "item";

      const content = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = product.name;

      const priceRow = document.createElement("div");
      priceRow.className = "price-row";
      priceRow.append(
        textNode("当前价格："),
        field(product.status?.price ? `¥${product.status.price}` : "暂无", "price"),
        textNode(`上次检查：${product.status?.lastCheckedAt || "暂无"}`)
      );

      const meta = document.createElement("div");
      meta.className = "meta";
      const code = document.createElement("span");
      code.textContent = `编号：${product.id}`;
      const link = document.createElement("a");
      link.href = product.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "打开商品页";
      meta.append(code, link);

      content.append(title, priceRow, meta);

      if (product.status?.lastError) {
        const error = document.createElement("div");
        error.className = "error";
        error.textContent = `抓取失败：${product.status.lastError}`;
        content.append(error);
      }

      const actions = document.createElement("div");
      const deleteButton = document.createElement("button");
      deleteButton.className = "danger";
      deleteButton.type = "button";
      deleteButton.dataset.deleteId = product.id;
      deleteButton.dataset.deleteName = product.name;
      deleteButton.textContent = "删除";
      actions.append(deleteButton);

      item.append(content, actions);
      return item;
    })
  );
}

function field(value, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = value;
  return span;
}

function textNode(value) {
  return document.createTextNode(value);
}

async function ensureOk(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(body?.error || `请求失败：${response.status}`);
  }

  return body;
}
