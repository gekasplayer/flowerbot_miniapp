let tg = window.Telegram.WebApp;
tg.expand();

function getImageUrl(url) {
    if (!url) return '';
    return url;
}

if (!tg.initData) {
    tg.showAlert("Увага: initData пуста! Відкривайте панель тільки через Inline-кнопку в Telegram.");
}

let productsData = [];
let addonsEnabled = true;

const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('shop_id');

async function fetchProducts() {
    try {
        let response = await fetch(`/api/${shopId}/manager/products?shop_id=${shopId}`, {
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData
            }
        });
        let result = await response.json();
        if (result.status === 'ok') {
            productsData = result.products;
            addonsEnabled = result.addons_enabled;
        } else {
            tg.showAlert("Помилка завантаження каталогу: " + result.message);
        }
    } catch (e) {
        tg.showAlert("Не вдалося підключитися до сервера. Перевірте з'єднання.");
    }
}

// Generate tabs logic identical to app.js
function generateTabs() {
    const mainContainer = document.getElementById('main-tabs-container');
    const compositionCategories = [...new Set(productsData.filter(p => p.type === 'composition').flatMap(p => p.categories))];
    
    let mainHtml = `<button class="tab-btn active" onclick="switchTab('all', this, 'composition')">Всі букети</button>`;
    compositionCategories.forEach(cat => {
        mainHtml += `<button class="tab-btn" onclick="switchTab('${cat}', this, 'composition')">${cat}</button>`;
    });
    if (addonsEnabled) {
        mainHtml += `<button class="tab-btn" onclick="switchTab('all', this, 'addon')" style="border-color: #e91e63; color: #e91e63;">🧸 Доповнення</button>`;
    }
    mainContainer.innerHTML = mainHtml;

    const subContainer = document.getElementById('sub-tabs-container');
    const flowerCategories = [...new Set(productsData.filter(p => p.type === 'flower').flatMap(p => p.categories))];
    
    let subHtml = `<button class="sub-tab-btn active" onclick="switchTab('all', this, 'flower')">Всі поштучні квіти</button>`;
    flowerCategories.forEach(cat => {
        subHtml += `<button class="sub-tab-btn" onclick="switchTab('${cat}', this, 'flower')">${cat}</button>`;
    });
    subContainer.innerHTML = subHtml;
    
    // Add horizontal scroll
    enableHorizontalScroll('.tabs-container');
    enableHorizontalScroll('.sub-tabs-container');
}

let currentType = 'composition';
let currentCategory = 'all';

function switchTab(categoryId, element, type) {
    if (type === 'composition') {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    } else {
        document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    }
    
    if (element) {
        element.classList.add('active');
    }

    currentType = type;
    currentCategory = categoryId;
    
    renderProducts();
}

function renderProducts() {
    const container = document.getElementById('products-grid');
    container.innerHTML = '';

    let filtered = productsData.filter(p => p.type === currentType);

    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.categories && p.categories.includes(currentCategory));
    }

    filtered.forEach(p => {
        const isAvailable = p.is_available;
        const disabledClass = isAvailable ? '' : 'item-disabled';
        const checkedAttr = isAvailable ? 'checked' : '';
        const statusText = isAvailable ? 'Є в наявності' : 'Немає';
        const statusColor = isAvailable ? '#4CAF50' : '#f44336';

        const descHtml = p.description ? `<p class="item-description">${p.description}</p>` : '';

        const card = `
            <div class="item ${disabledClass}" id="product-card-${p.id}" onclick="openProductModal(${p.id})">
                <img src="${getImageUrl(p.image)}" alt="${p.name}">
                <h3 style="margin: 5px 0 2px 0; font-size: 16px;">${p.name}</h3>
                ${descHtml}
                <p style="margin: 0 0 10px 0; font-weight: bold;">${p.price} грн</p>
                
                <div class="toggle-container" onclick="event.stopPropagation()">
                    <span class="toggle-label" id="status-text-${p.id}" style="color: ${statusColor}">${statusText}</span>
                    <label class="switch">
                      <input type="checkbox" onchange="toggleAvailability(${p.id})" ${checkedAttr}>
                      <span class="slider"></span>
                    </label>
                </div>
                
                <div class="manager-actions" onclick="event.stopPropagation()">
                    <button class="action-btn edit-btn" onclick="openEditModal(${p.id})">✏️ Редагувати</button>
                    <button class="action-btn delete-btn" onclick="deleteProduct(${p.id})">🗑 Видалити</button>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

async function toggleAvailability(productId) {
    try {
        let response = await fetch(`/api/${shopId}/manager/products/${productId}/toggle?shop_id=${shopId}`, {
            method: 'POST',
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData
            }
        });
        
        let result = await response.json();
        if (result.status === 'ok') {
            try { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); } catch (e) { }
            
            // Update local state
            let product = productsData.find(p => p.id === productId);
            if (product) {
                product.is_available = !product.is_available;
                
                // Update UI visually without full re-render
                const card = document.getElementById(`product-card-${productId}`);
                const statusText = document.getElementById(`status-text-${productId}`);
                
                if (product.is_available) {
                    card.classList.remove('item-disabled');
                    statusText.innerText = 'Є в наявності';
                    statusText.style.color = '#4CAF50';
                } else {
                    card.classList.add('item-disabled');
                    statusText.innerText = 'Немає';
                    statusText.style.color = '#f44336';
                }
            }
        } else {
            tg.showAlert("Помилка збереження: " + result.message);
            // Re-render to revert toggle state
            renderProducts();
        }
    } catch (e) {
        tg.showAlert("Не вдалося підключитися до сервера.");
        renderProducts();
    }
}

function enableHorizontalScroll(selector) {
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
        container.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            container.scrollLeft += evt.deltaY;
        });
    });
}

// === Product Details Modal ===
function openProductModal(id) {
    let p = productsData.find(prod => prod.id === id);
    if (!p) return;
    
    let imgEl = document.getElementById('pm-image');
    imgEl.src = getImageUrl(p.image);
    
    document.getElementById('pm-title').innerText = p.name;
    document.getElementById('pm-desc').innerText = p.description || '';
    document.getElementById('pm-price').innerText = p.price + ' грн';
    
    document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.remove('active');
}

// === Edit/Delete Functionality ===

let currentEditId = null;

function openEditModal(productId) {
    let product = productsData.find(p => p.id === productId);
    if (!product) return;
    
    currentEditId = productId;
    document.getElementById('edit-name').value = product.name;
    document.getElementById('edit-desc').value = product.description;
    document.getElementById('edit-price').value = product.price;
    document.getElementById('edit-image-file').value = '';
    document.getElementById('edit-image-url').value = product.image || '';
    document.getElementById('edit-upload-status').innerText = '';
    
    document.getElementById('edit-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditId = null;
}

async function saveProduct() {
    if (!currentEditId) return;
    
    const name = document.getElementById('edit-name').value;
    const desc = document.getElementById('edit-desc').value;
    const price = document.getElementById('edit-price').value;
    const imageUrl = document.getElementById('edit-image-url').value;
    
    try {
        let response = await fetch(`/api/${shopId}/manager/products/${currentEditId}/update`, {
            method: 'POST',
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shop_id: parseInt(shopId),
                name: name,
                description: desc,
                price: price,
                image: imageUrl
            })
        });
        let result = await response.json();
        if (result.status === 'ok') {
            tg.showAlert("Товар збережено!");
            closeEditModal();
            await fetchProducts();
            renderProducts();
        } else {
            tg.showAlert("Помилка: " + result.message);
        }
    } catch (e) {
        tg.showAlert("Не вдалося підключитися до сервера.");
    }
}

async function deleteProduct(productId) {
    tg.showConfirm("Ви впевнені, що хочете назавжди видалити цей товар?", async (confirmed) => {
        if (!confirmed) return;
        
        try {
            let response = await fetch(`/api/${shopId}/manager/products/${productId}?shop_id=${shopId}`, {
                method: 'DELETE',
                headers: {
                    "Authorization": "tma " + window.Telegram.WebApp.initData
                }
            });
            let result = await response.json();
            if (result.status === 'ok') {
                tg.showAlert("Товар видалено!");
                await fetchProducts();
                renderProducts();
            } else {
                tg.showAlert("Помилка: " + result.message);
            }
        } catch (e) {
            tg.showAlert("Не вдалося підключитися до сервера.");
        }
    });
}
// === Create Product Functionality ===
let allCategories = [];

async function fetchCategories() {
    try {
        let response = await fetch(`/api/${shopId}/manager/categories?shop_id=${shopId}`, {
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData
            }
        });
        let result = await response.json();
        if (result.status === 'ok') {
            allCategories = result.categories.map(c => c.name);
        }
    } catch (e) {
        console.error("Помилка завантаження категорій", e);
    }
}

function openCreateModal() {
    document.getElementById('create-name').value = '';
    document.getElementById('create-desc').value = '';
    document.getElementById('create-price').value = '';
    document.getElementById('create-type').value = 'flower';
    document.getElementById('create-image-file').value = '';
    document.getElementById('create-image-url').value = '';
    document.getElementById('upload-status').innerText = '';
    document.getElementById('new-category-name').value = '';
    
    renderCategories();
    document.getElementById('create-modal').style.display = 'block';
}

function closeCreateModal() {
    document.getElementById('create-modal').style.display = 'none';
}

function renderCategories() {
    const list = document.getElementById('create-categories-list');
    list.innerHTML = '';
    allCategories.forEach(cat => {
        list.innerHTML += `
            <label class="cat-checkbox">
                <input type="checkbox" value="${cat}" class="create-cat-chk"> ${cat}
            </label>
        `;
    });
}

function addNewCategoryCheckbox() {
    const input = document.getElementById('new-category-name');
    const cat = input.value.trim();
    if (!cat) return;
    
    if (!allCategories.includes(cat)) {
        allCategories.push(cat);
        const list = document.getElementById('create-categories-list');
        list.innerHTML += `
            <label class="cat-checkbox">
                <input type="checkbox" value="${cat}" class="create-cat-chk" checked> ${cat}
            </label>
        `;
    }
    input.value = '';
}

async function uploadImage(input, statusId, urlId) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const statusDiv = document.getElementById(statusId);
    const urlInput = document.getElementById(urlId);
    
    statusDiv.innerText = '⏳ Завантаження фото на сервер...';
    statusDiv.style.color = '#ff9800';
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        let response = await fetch(`/api/${shopId}/manager/upload_image?shop_id=${shopId}`, {
            method: 'POST',
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData
            },
            body: formData
        });
        let result = await response.json();
        if (result.status === 'ok') {
            statusDiv.innerText = '✅ Фото завантажено!';
            statusDiv.style.color = '#4CAF50';
            urlInput.value = result.url;
        } else {
            statusDiv.innerText = '❌ Помилка: ' + result.message;
            statusDiv.style.color = '#f44336';
        }
    } catch (e) {
        statusDiv.innerText = '❌ Помилка з\'єднання';
        statusDiv.style.color = '#f44336';
    }
}

async function submitNewProduct() {
    const name = document.getElementById('create-name').value.trim();
    const desc = document.getElementById('create-desc').value.trim();
    const price = document.getElementById('create-price').value;
    const type = document.getElementById('create-type').value;
    const imageUrl = document.getElementById('create-image-url').value.trim();
    
    if (!name || !price) {
        tg.showAlert("Будь ласка, вкажіть назву та ціну!");
        return;
    }
    
    const checkboxes = document.querySelectorAll('.create-cat-chk');
    const selectedCategories = [];
    checkboxes.forEach(chk => {
        if (chk.checked) selectedCategories.push(chk.value);
    });
    
    try {
        let response = await fetch(`/api/${shopId}/manager/products`, {
            method: 'POST',
            headers: {
                "Authorization": "tma " + window.Telegram.WebApp.initData,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                shop_id: parseInt(shopId),
                name: name,
                description: desc,
                price: price,
                type: type,
                image: imageUrl,
                categories: selectedCategories
            })
        });
        let result = await response.json();
        if (result.status === 'ok') {
            tg.showAlert("Товар успішно створено!");
            closeCreateModal();
            await fetchProducts();
            generateTabs();
            let firstTab = document.querySelector('.tab-btn');
            switchTab('all', firstTab, 'composition');
        } else {
            tg.showAlert("Помилка: " + result.message);
        }
    } catch (e) {
        tg.showAlert("Не вдалося підключитися до сервера.");
    }
}

window.onload = async () => {
    await fetchProducts();
    await fetchCategories();
    generateTabs();
    
    if (!addonsEnabled) {
        const optAddon = document.getElementById('opt-addon');
        if (optAddon) optAddon.remove();
    }
    
    // Show composition all initially
    let firstTab = document.querySelector('.tab-btn');
    switchTab('all', firstTab, 'composition');
};
