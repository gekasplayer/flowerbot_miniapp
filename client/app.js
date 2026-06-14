let tg = window.Telegram.WebApp;
tg.expand();

// 1. ДИНАМІЧНИЙ КАТАЛОГ
let productsData = [];
let addonsEnabled = true;

async function fetchProducts() {
    try {
        let response = await fetch('https://c1ba-188-163-31-104.ngrok-free.app/api/products?shop_id=2', {
            headers: {
                "ngrok-skip-browser-warning": "69420"
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

let regularCart = {};
let constructorCart = {};
let customBouquetsList = [];

// ==========================================
// ГЕНЕРАЦІЯ ДИНАМІЧНИХ ВКЛАДОК
// ==========================================
function generateTabs() {
    // 1. Головні вкладки (Готові букети)
    const mainContainer = document.getElementById('main-tabs-container');
    const compositionCategories = [...new Set(productsData.filter(p => p.type === 'composition').flatMap(p => p.categories))];
    
    let mainHtml = `<button class="tab-btn active" onclick="switchTab('all', this)">Всі букети</button>`;
    compositionCategories.forEach(cat => {
        mainHtml += `<button class="tab-btn" onclick="switchTab('${cat}', this)">${cat}</button>`;
    });
    mainHtml += `<button class="tab-btn constructor-tab" onclick="switchTab('constructor', this)">🛠 Зібрати свій</button>`;
    if (addonsEnabled) {
        mainHtml += `<button class="tab-btn" onclick="switchTab('addons', this)" style="border-color: #e91e63; color: #e91e63;">🧸 Доповнення</button>`;
    }
    mainContainer.innerHTML = mainHtml;

    // 2. Підвкладки конструктора (Поштучні квіти)
    const subContainer = document.getElementById('sub-tabs-container');
    const flowerCategories = [...new Set(productsData.filter(p => p.type === 'flower').flatMap(p => p.categories))];
    
    let subHtml = `<button class="sub-tab-btn active" onclick="switchConstructorTab('all', this)">Всі квіти</button>`;
    flowerCategories.forEach(cat => {
        subHtml += `<button class="sub-tab-btn" onclick="switchConstructorTab('${cat}', this)">${cat}</button>`;
    });
    subContainer.innerHTML = subHtml;
}

// ==========================================
// ЛОГІКА ГОЛОВНИХ ВКЛАДОК (Вітрина)
// ==========================================
function switchTab(tabId, element) {
    // Оновлюємо дизайн головних кнопок
    if (element) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }

    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));

    if (tabId === 'constructor') {
        document.getElementById('constructor-section').classList.add('active');
        // За замовчуванням при вході в конструктор показуємо всі квіти
        let firstSubTab = document.querySelector('.sub-tab-btn');
        switchConstructorTab('all', firstSubTab);
    } else if (tabId === 'addons') {
        document.getElementById('catalog-section').classList.add('active');
        let filtered = productsData.filter(p => p.type === 'addon');
        
        if (filtered.length === 0) {
            const grid = document.getElementById('products-grid');
            grid.innerHTML = '<p style="width: 100%; text-align: center; color: #888; font-size: 14px; margin-top: 20px;">Доповнення ще не додані в асортимент.</p>';
        } else {
            renderProducts(filtered, 'products-grid', false);
        }
    } else {
        document.getElementById('catalog-section').classList.add('active');

        // ЖОРСТКИЙ ФІЛЬТР 1: Беремо ТІЛЬКИ готові букети
        let filtered = productsData.filter(p => p.type === 'composition');

        // Додатковий фільтр по категоріях вітрини (якщо не 'all')
        if (tabId !== 'all') {
            filtered = filtered.filter(p => p.categories && p.categories.includes(tabId));
        }
        renderProducts(filtered, 'products-grid', false);
    }
}

// ==========================================
// ЛОГІКА ПІДВКЛАДОК (Конструктор)
// ==========================================
function switchConstructorTab(categoryId, element) {
    // Оновлюємо дизайн маленьких кнопок
    if (element) {
        document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }

    // ЖОРСТКИЙ ФІЛЬТР 2: Беремо ТІЛЬКИ поштучні квіти
    let filtered = productsData.filter(p => p.type === 'flower');

    // Фільтруємо за підкатегорією (Троянди, Інше)
    if (categoryId !== 'all') {
        filtered = filtered.filter(p => p.categories && p.categories.includes(categoryId));
    }

    renderProducts(filtered, 'constructor-grid', true);
}



function renderProducts(products, containerId, isConstructor) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    products.forEach(p => {
        let currentQty = 0;
        if (isConstructor && constructorCart[p.id]) currentQty = constructorCart[p.id].quantity;
        if (!isConstructor && regularCart[p.id]) currentQty = regularCart[p.id].quantity;

        // Перевіряємо, чи є опис (якщо раптом в БД буде порожньо)
        const descHtml = p.description ? `<p class="item-description">${p.description}</p>` : '';

        // Зверни увагу, що я додав descHtml сюди
        const card = `
            <div class="item">
                <img src="${p.image}" alt="${p.name}">
                <h3 style="margin: 5px 0 2px 0; font-size: 16px;">${p.name}</h3>
                ${descHtml}
                <p style="margin: 0 0 10px 0; color: var(--tg-theme-text-color, #000); font-weight: bold;">${p.price} грн</p>
                <div class="controls">
                    <button class="btn-calc" onclick="changeQty(${p.id}, -1, ${isConstructor})">-</button>
                    <span id="qty-${isConstructor ? 'const-' : ''}${p.id}" class="qty-text">${currentQty}</span>
                    <button class="btn-calc" onclick="changeQty(${p.id}, 1, ${isConstructor})">+</button>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

// ==========================================
// 4. ЛОГІКА КОШИКА (+ та -)
// ==========================================
function changeQty(id, delta, isConstructor) {
    let targetCart = isConstructor ? constructorCart : regularCart;
    let product = productsData.find(p => p.id === id);

    if (!targetCart[id]) {
        targetCart[id] = { ...product, quantity: 0 };
    }

    targetCart[id].quantity += delta;

    // Якщо кількість 0 або менше — видаляємо
    if (targetCart[id].quantity <= 0) {
        delete targetCart[id];
        document.getElementById(`qty-${isConstructor ? 'const-' : ''}${id}`).innerText = "0";
    } else {
        document.getElementById(`qty-${isConstructor ? 'const-' : ''}${id}`).innerText = targetCart[id].quantity;
    }

    try { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) { }

    updateGlobalCartState();
}

// ==========================================
// 5. ЛОГІКА КОНСТРУКТОРА (Загорнути букет)
// ==========================================
function packCustomBouquet() {
    let items = Object.values(constructorCart);
    if (items.length === 0) {
        tg.showAlert("Оберіть хоча б одну квітку для вашого букета!");
        return;
    }

    let wishes = document.getElementById('wishes-text').value;
    let totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    customBouquetsList.push({
        type: "custom_bouquet",
        wishes_text: wishes,
        total_price: totalPrice,
        quantity: 1, // НОВЕ ПОЛЕ: Кількість таких букетів за замовчуванням
        items: items.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price, name: i.name }))
    });

    constructorCart = {};
    document.getElementById('wishes-text').value = '';

    let flowers = productsData.filter(p => p.type === 'flower');
    renderProducts(flowers, 'constructor-grid', true);

    tg.showAlert("✨ Ваш кастомний букет успішно додано до кошика!");
    updateGlobalCartState();
}

// ==========================================
// 6. МОДАЛЬНЕ ВІКНО КОШИКА ТА ФІНАЛІЗАЦІЯ
// ==========================================
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    modal.classList.toggle('active');
    if (modal.classList.contains('active')) {
        renderCartModal();
    }
}

function updateGlobalCartState() {
    // Враховуємо quantity для кастомних букетів
    let totalItems = Object.values(regularCart).reduce((sum, item) => sum + item.quantity, 0) +
        customBouquetsList.reduce((sum, bq) => sum + (bq.quantity || 1), 0);

    let totalPrice = Object.values(regularCart).reduce((sum, item) => sum + (item.price * item.quantity), 0) +
        customBouquetsList.reduce((sum, bq) => sum + (bq.total_price * (bq.quantity || 1)), 0);

    document.getElementById('cart-badge').innerText = totalItems;

    if (totalItems > 0) {
        tg.MainButton.setText(`ОФОРМИТИ (${totalPrice} грн)`);
        tg.MainButton.show();
    } else {
        tg.MainButton.hide();
        document.getElementById('cart-modal').classList.remove('active');
    }

    tg.CloudStorage.setItem("flower_cart", JSON.stringify({ regular: regularCart, custom: customBouquetsList }));
}

function renderCartModal() {
    const list = document.getElementById('cart-items-list');
    list.innerHTML = '';
    let grandTotal = 0;

    // 1. Малюємо звичайні товари
    Object.values(regularCart).forEach(item => {
        let cost = item.price * item.quantity;
        grandTotal += cost;
        list.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-details">${item.price} грн/шт</div>
                    <div class="cart-item-price">${cost} грн</div>
                </div>
                <div class="cart-item-actions">
                    <div class="controls" style="margin: 0; width: auto;">
                        <button class="btn-calc" onclick="changeQty(${item.id}, -1, false); renderCartModal();">-</button>
                        <span class="qty-text">${item.quantity}</span>
                        <button class="btn-calc" onclick="changeQty(${item.id}, 1, false); renderCartModal();">+</button>
                    </div>
                    <button class="btn-delete" onclick="deleteRegularItem(${item.id})">🗑 Видалити</button>
                </div>
            </div>
        `;
    });

    // 2. Малюємо кастомні букети
    customBouquetsList.forEach((bq, index) => {
        let bqQty = bq.quantity || 1;
        let cost = bq.total_price * bqQty;
        grandTotal += cost;

        let bouquetDetails = bq.items.map(i => `— ${i.name} (${i.quantity} шт)`).join('<br>');
        list.innerHTML += `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">Власний букет №${index + 1}</div>
                    <div class="cart-item-details">
                        ${bouquetDetails}
                        ${bq.wishes_text ? `<br><span style="color:#ff9800;">📝 ${bq.wishes_text}</span>` : ''}
                    </div>
                    <div class="cart-item-price">${cost} грн</div>
                </div>
                <div class="cart-item-actions">
                    <div class="controls" style="margin: 0; width: auto;">
                        <button class="btn-calc" onclick="changeCustomQty(${index}, -1)">-</button>
                        <span class="qty-text">${bqQty}</span>
                        <button class="btn-calc" onclick="changeCustomQty(${index}, 1)">+</button>
                    </div>
                    <button class="btn-delete" onclick="deleteCustomBouquet(${index})">🗑 Видалити</button>
                </div>
            </div>
        `;
    });

    document.getElementById('total-price-text').innerText = grandTotal;
}

// Нова допоміжна функція для видалення кастомного букета
function deleteCustomBouquet(index) {
    customBouquetsList.splice(index, 1); // Видаляємо букет з масиву за його індексом
    try { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); } catch (e) { }
    updateGlobalCartState(); // Оновлюємо лічильники та кнопку Telegram
    renderCartModal();      // Перемальовуємо вікно кошика
}


// Зміна кількості кастомного букета
function changeCustomQty(index, delta) {
    customBouquetsList[index].quantity = (customBouquetsList[index].quantity || 1) + delta;
    if (customBouquetsList[index].quantity <= 0) {
        deleteCustomBouquet(index);
    } else {
        try { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light'); } catch (e) { }
        updateGlobalCartState();
        renderCartModal();
    }
}

// Повне видалення звичайного товару через кнопку "Смітничок"
function deleteRegularItem(id) {
    delete regularCart[id];
    document.getElementById(`qty-${id}`).innerText = "0"; // Оновлюємо цифру і на вітрині
    try { if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium'); } catch (e) { }
    updateGlobalCartState();
    renderCartModal();
}


// Відправка даних у Бот (Генерація фінального JSON контракту)
Telegram.WebApp.onEvent("mainButtonClicked", function () {
    let payloadCustom = [];

    // Якщо клієнт замовив 2 однакових кастомних букети, відправляємо їх як 2 окремі об'єкти
    customBouquetsList.forEach(bq => {
        let q = bq.quantity || 1;
        for (let i = 0; i < q; i++) {
            payloadCustom.push(bq);
        }
    });

    let payload = {
        cart: [
            ...Object.values(regularCart).map(item => ({ type: item.type, product_id: item.id, quantity: item.quantity, price: item.price })),
            ...payloadCustom
        ]
    };
    tg.sendData(JSON.stringify(payload));
});


// Запускаємо рендер та перевіряємо хмару при завантаженні
window.onload = async () => {
    // 1. Спочатку завантажуємо продукти з API
    await fetchProducts();

    // 1.5 Генеруємо динамічні вкладки на основі отриманих категорій
    generateTabs();

    // 2. Просимо Telegram дістати збережений кошик
    tg.CloudStorage.getItem("flower_cart", function (error, value) {
        if (!error && value) {
            // Якщо кошик знайдено, розпаковуємо його
            let savedData = JSON.parse(value);
            regularCart = savedData.regular || {};
            customBouquetsList = savedData.custom || [];

            // Оновлюємо кнопку та лічильник
            updateGlobalCartState();
        }

        // Малюємо початкову вкладку ТІЛЬКИ ПІСЛЯ ТОГО, як завантажили кошик та товари
        let firstTab = document.querySelector('.tab-btn');
        switchTab('all', firstTab);
        
        // Додаємо горизонтальний скрол коліщатком миші
        enableHorizontalScroll('.tabs-container');
        enableHorizontalScroll('.sub-tabs-container');
    });
};

function enableHorizontalScroll(selector) {
    const containers = document.querySelectorAll(selector);
    containers.forEach(container => {
        container.addEventListener('wheel', (evt) => {
            evt.preventDefault();
            container.scrollLeft += evt.deltaY;
        });
    });
}

