let tg = window.Telegram.WebApp;
tg.expand();

let productsData = [];

async function fetchProducts() {
    try {
        let response = await fetch('https://d82e-188-163-31-104.ngrok-free.app/api/manager/products?shop_id=2', {
            headers: {
                "ngrok-skip-browser-warning": "69420"
            }
        });
        let result = await response.json();
        if (result.status === 'ok') {
            productsData = result.products;
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
    mainContainer.innerHTML = mainHtml;

    const subContainer = document.getElementById('sub-tabs-container');
    const flowerCategories = [...new Set(productsData.filter(p => p.type === 'flower').flatMap(p => p.categories))];
    
    let subHtml = `<button class="sub-tab-btn active" onclick="switchTab('all', this, 'flower')">Всі квіти (Поштучно)</button>`;
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
            <div class="item ${disabledClass}" id="product-card-${p.id}">
                <img src="${p.image}" alt="${p.name}">
                <h3 style="margin: 5px 0 2px 0; font-size: 16px;">${p.name}</h3>
                ${descHtml}
                <p style="margin: 0 0 10px 0; font-weight: bold;">${p.price} грн</p>
                
                <div class="toggle-container">
                    <span class="toggle-label" id="status-text-${p.id}" style="color: ${statusColor}">${statusText}</span>
                    <label class="switch">
                      <input type="checkbox" onchange="toggleAvailability(${p.id})" ${checkedAttr}>
                      <span class="slider"></span>
                    </label>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

async function toggleAvailability(productId) {
    try {
        let response = await fetch(`https://d82e-188-163-31-104.ngrok-free.app/api/manager/products/${productId}/toggle`, {
            method: 'POST',
            headers: {
                "ngrok-skip-browser-warning": "69420"
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

window.onload = async () => {
    await fetchProducts();
    generateTabs();
    
    // Show composition all initially
    let firstTab = document.querySelector('.tab-btn');
    switchTab('all', firstTab, 'composition');
};
