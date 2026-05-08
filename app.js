// ==========================
// CONFIGURACIÓN SUPABASE
// ==========================
const SUPABASE_URL = 'https://nbcxafnjolasdmleqjhp.supabase.co'; // <-- Reemplaza con tu URL real
const SUPABASE_KEY = 'sb_publishable_0CmPrpHpz_iz8ZOI04uZ4A_VcNCpncN'; // <-- Reemplaza con tu Key real
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================
// ESTADO GLOBAL
// ==========================
let cart = [];
let selectedPolo = null;
let selectedColor = null;
let selectedTalla = null;
let selectedCantidad = 1;
let maxCantidadDisponible = 0;
let currentStockMap = {};

// ==========================
// FUNCIONES DE AYUDA
// ==========================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getColorCode(color) {
    const colors = {
        'Rojo': '#FF0000', 'Azul': '#0000FF', 'Negro': '#000000',
        'Blanco': '#F0F0F0', 'Verde': '#00FF00', 'Amarillo': '#FFFF00',
        'Gris': '#999999', 'Rosa': '#FFC0CB', 'Morado': '#800080',
        'Naranja': '#FFA500', 'Celeste': '#87CEEB', 'Marrón': '#8B4513',
        'Beige': '#F5F5DC', 'Plateado': '#C0C0C0', 'Dorado': '#FFD700'
    };
    return colors[color] || '#CCCCCC';
}

// ==========================
// NAVEGACIÓN
// ==========================
function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('panel-' + tabId);
    if (target) target.classList.add('active');
    if (tabId === 'admin') loadInventory();
    if (tabId === 'cart') renderCart();
    window.scrollTo(0, 0);
}

// ==========================
// CARGA DE PRODUCTOS EN TIENDA
// ==========================
async function loadProducts() {
    const grid = document.getElementById('storeGrid');
    if (!grid) return;

    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        showToast("❌ Error al cargar productos: " + error.message);
        return;
    }

    grid.innerHTML = '';
    if (!polos || polos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1;">No hay productos disponibles.</p>';
        return;
    }

    polos.forEach(p => {
        const stockTotal = p.stock || 0;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.polo = encodeURIComponent(JSON.stringify(p));
        card.dataset.categoria = p.categoria?.toLowerCase() || '';
        card.innerHTML = `
            <img src="${p.imagen_url || 'https://via.placeholder.com/300?text=Sin+imagen'}"
                 onerror="this.src='https://via.placeholder.com/300?text=Sin+imagen'"
                 alt="${escapeHtml(p.nombre)}">
            <div class="product-info">
                <h3>${escapeHtml(p.nombre)}</h3>
                <p>S/ ${parseFloat(p.precio).toFixed(2)}</p>
                ${stockTotal > 0 
                    ? `<small style="color:green;">✅ En stock</small>` 
                    : `<small style="color:red;">❌ Agotado</small>`}
            </div>
        `;
        card.addEventListener('click', () => openModal(p));
        grid.appendChild(card);
    });
}

// ==========================
// ADMIN - INVENTARIO
// ==========================
async function loadInventory() {
    const list = document.getElementById('adminInventoryList');
    if (!list) return;

    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        showToast("❌ Error al cargar inventario: " + error.message);
        return;
    }

    list.innerHTML = '';
    if (!polos || polos.length === 0) {
        list.innerHTML = '<p>No hay productos registrados.</p>';
        return;
    }

    polos.forEach(p => {
        const item = document.createElement('div');
        item.className = 'inventory-item';
        item.innerHTML = `
            <img src="${p.imagen_url || 'https://via.placeholder.com/50'}" 
                 onerror="this.src='https://via.placeholder.com/50'"
                 alt="${escapeHtml(p.nombre)}">
            <div style="flex-grow:1; margin-left:15px;">
                <h4 style="font-size:14px;">${escapeHtml(p.nombre)}</h4>
                <small>S/ ${parseFloat(p.precio).toFixed(2)}</small><br>
                <small style="color:#888;">${escapeHtml(p.categoria || 'Sin categoría')}</small><br>
                <small style="color:${(p.stock || 0) > 0 ? 'green' : 'red'};">
                    📦 Stock: ${p.stock || 0} unidades
                </small>
            </div>
            <button class="edit-btn" data-id="${p.id}" 
                    data-polo='${encodeURIComponent(JSON.stringify(p))}'>✏️</button>
            <button class="delete-btn" data-id="${p.id}">🗑️</button>
        `;

        item.querySelector('.edit-btn').addEventListener('click', (e) => {
            const poloData = JSON.parse(decodeURIComponent(e.currentTarget.dataset.polo));
            prepareEdit(poloData);
        });
        item.querySelector('.delete-btn').addEventListener('click', () => deletePolo(p.id));

        list.appendChild(item);
    });
}

// ==========================
// STOCK POR VARIANTE
// ==========================
function generateStockFields() {
    const tallas = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];

    const container = document.getElementById('stockFieldsContainer');
    const stockDiv = document.getElementById('stockFields');
    if (!container || !stockDiv) return;

    if (tallas.length > 0 && colores.length > 0) {
        container.style.display = 'block';
        let html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
        html += '<tr><th style="padding:8px; background:#0a0a0a; color:white;">Color / Talla</th>';
        tallas.forEach(t => html += `<th style="padding:8px; background:#0a0a0a; color:white;">${t}</th>`);
        html += '</tr>';

        colores.forEach(color => {
            html += `<tr><td style="background:#f0f0f0; padding:8px;"><strong>${color}</strong></td>`;
            tallas.forEach(talla => {
                const fieldId = `stock_${talla}_${color.replace(/\s/g, '_')}`;
                html += `<td style="padding:5px;">
                    <input type="number" id="${fieldId}" value="0" min="0" 
                           style="width:70px; padding:5px; text-align:center;">
                </td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        stockDiv.innerHTML = html;
    } else {
        container.style.display = 'none';
        stockDiv.innerHTML = '';
    }
}

async function loadExistingStocks(poloId) {
    const { data: stocks } = await _supabase
        .from('polo_stock')
        .select('*')
        .eq('polo_id', poloId);

    if (stocks) {
        stocks.forEach(s => {
            const fieldId = `stock_${s.talla}_${s.color.replace(/\s/g, '_')}`;
            const field = document.getElementById(fieldId);
            if (field) field.value = s.cantidad;
        });
    }
}

// ==========================
// ADMIN - CRUD PRODUCTOS
// ==========================
async function saveProduct() {
    const id = document.getElementById('editPoloId').value;
    const nombre = document.getElementById('prodName').value.trim();
    const precio = document.getElementById('prodPrice').value;
    const descripcion = document.getElementById('prodDesc').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const file = document.getElementById('imgFileInput').files[0];

    const tallasChecked = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];

    if (!nombre || !precio) { showToast("⚠️ Llena nombre y precio"); return; }
    if (tallasChecked.length === 0) { showToast("⚠️ Selecciona al menos una talla"); return; }
    if (colores.length === 0) { showToast("⚠️ Ingresa al menos un color"); return; }

    const btn = document.getElementById('saveBtn');
    btn.innerText = "PROCESANDO...";
    btn.disabled = true;

    const variantes = [];
    tallasChecked.forEach(talla => {
        colores.forEach(color => {
            const fieldId = `stock_${talla}_${color.replace(/\s/g, '_')}`;
            const field = document.getElementById(fieldId);
            const cantidad = field ? parseInt(field.value) || 0 : 0;
            variantes.push({ talla, color, cantidad });
        });
    });
    const stockTotal = variantes.reduce((sum, v) => sum + v.cantidad, 0);

    const updateData = {
        nombre,
        precio: parseFloat(precio),
        descripcion,
        categoria,
        stock: stockTotal,
        tallas: tallasChecked,
        colores: colores
    };

    if (file) {
        const fileName = `polo_${Date.now()}.png`;
        const { error: uploadError } = await _supabase.storage
            .from('imagenes-polos')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            showToast("❌ Error al subir imagen: " + uploadError.message);
            btn.innerText = "GUARDAR CAMBIOS";
            btn.disabled = false;
            return;
        }

        const { data: urlData } = _supabase.storage
            .from('imagenes-polos')
            .getPublicUrl(fileName);
        updateData.imagen_url = urlData.publicUrl;
    }

    let poloId = id;
    let error;

    if (id) {
        ({ error } = await _supabase.from('polos').update(updateData).eq('id', id));
    } else {
        const res = await _supabase.from('polos').insert([updateData]).select();
        error = res.error;
        if (!error && res.data?.length) poloId = res.data[0].id;
    }

    if (error) {
        showToast("❌ Error al guardar: " + error.message);
        btn.innerText = "GUARDAR CAMBIOS";
        btn.disabled = false;
        return;
    }

    if (poloId) {
        await _supabase.from('polo_stock').delete().eq('polo_id', poloId);
        const inserts = variantes.map(v => ({
            polo_id: poloId,
            talla: v.talla,
            color: v.color,
            cantidad: v.cantidad
        }));
        await _supabase.from('polo_stock').insert(inserts);
    }

    showToast("✅ Producto guardado correctamente");
    resetForm();
    btn.innerText = "GUARDAR CAMBIOS";
    btn.disabled = false;
    await loadProducts();
    await loadInventory();
}

async function deletePolo(id) {
    if (!confirm("¿Eliminar este producto permanentemente?")) return;
    const { error } = await _supabase.from('polos').delete().eq('id', id);
    if (error) {
        showToast("❌ Error al eliminar: " + error.message);
    } else {
        showToast("🗑️ Producto eliminado");
        await loadInventory();
        await loadProducts();
    }
}

function prepareEdit(polo) {
    document.getElementById('formTitle').innerText = "Editando Polo";
    document.getElementById('editPoloId').value = polo.id;
    document.getElementById('prodName').value = polo.nombre || '';
    document.getElementById('prodPrice').value = polo.precio || '';
    document.getElementById('prodDesc').value = polo.descripcion || '';
    document.getElementById('prodCategoria').value = polo.categoria || 'Básico';
    document.getElementById('prodStock').value = polo.stock || 0;
    document.getElementById('prodColores').value = (polo.colores || []).join(', ');
    document.getElementById('fileLabel').innerHTML = "📷 Cambiar imagen (opcional)";
    document.getElementById('cancelEdit').style.display = 'block';

    document.querySelectorAll('.talla-check').forEach(cb => {
        cb.checked = (polo.tallas || []).includes(cb.value);
    });

    setTimeout(() => {
        generateStockFields();
        loadExistingStocks(polo.id);
    }, 100);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('formTitle').innerText = "Agregar Polo";
    document.getElementById('editPoloId').value = "";
    document.getElementById('prodName').value = "";
    document.getElementById('prodPrice').value = "";
    document.getElementById('prodDesc').value = "";
    document.getElementById('prodCategoria').value = "Básico";
    document.getElementById('prodStock').value = "0";
    document.getElementById('prodColores').value = "";
    document.getElementById('imgFileInput').value = "";
    document.getElementById('fileLabel').innerHTML = "📷 Seleccionar Imagen";
    document.getElementById('cancelEdit').style.display = 'none';
    document.querySelectorAll('.talla-check').forEach(cb => cb.checked = false);
    document.getElementById('stockFieldsContainer').style.display = 'none';
    document.getElementById('stockFields').innerHTML = '';
}

function updateLabel() {
    const file = document.getElementById('imgFileInput').files[0];
    const label = document.getElementById('fileLabel');
    label.innerHTML = file ? `📷 ${file.name}` : "📷 Seleccionar Imagen";
}

// ==========================
// MODAL DEL PRODUCTO (CLIENTE)
// ==========================
async function openModal(polo) {
    selectedPolo = polo;
    selectedColor = null;
    selectedTalla = null;
    selectedCantidad = 1;
    maxCantidadDisponible = 0;

    document.getElementById('modalImg').src = polo.imagen_url || 'https://via.placeholder.com/300';
    document.getElementById('modalName').innerText = polo.nombre;
    document.getElementById('modalPrice').innerText = `S/ ${parseFloat(polo.precio).toFixed(2)}`;
    document.getElementById('modalDesc').innerText = polo.descripcion || "Calidad Premium.";
    document.getElementById('modalCategoria').innerText = polo.categoria || "Básico";
    document.getElementById('colorSeleccionado').innerText = "—";
    document.getElementById('tallaSeleccionada').innerText = "—";
    document.getElementById('stockWarning').style.display = 'none';
    document.getElementById('cantidadValue').innerText = "1";
    document.getElementById('maxStock').innerText = "0";

    const colorOptions = document.getElementById('colorOptions');
    colorOptions.innerHTML = '';
    (polo.colores || []).forEach(color => {
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        div.innerHTML = `
            <div class="color-circle" 
                 style="background-color: ${getColorCode(color)};"
                 data-color="${color}">
            </div>
            <small style="font-size:10px; display:block; margin-top:4px;">${color}</small>
        `;
        div.querySelector('.color-circle').addEventListener('click', (e) => selectColor(color, e));
        colorOptions.appendChild(div);
    });

    const tallaOptions = document.getElementById('tallaOptions');
    tallaOptions.innerHTML = '';
    const tallas = polo.tallas || [];

    const { data: stockData } = await _supabase
        .from('polo_stock')
        .select('*')
        .eq('polo_id', polo.id);

    currentStockMap = {};
    if (stockData) {
        stockData.forEach(s => {
            currentStockMap[`${s.talla}_${s.color}`] = s.cantidad;
        });
    }

    tallas.forEach(talla => {
        const btn = document.createElement('button');
        btn.className = 'talla-btn';
        btn.innerText = talla;
        btn.addEventListener('click', (e) => selectTalla(talla, e));
        tallaOptions.appendChild(btn);
    });

    document.getElementById('modalOverlay').classList.add('open');
}

function selectColor(color, e) {
    selectedColor = color;
    document.getElementById('colorSeleccionado').innerText = color;

    document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('selected'));
    if (e?.currentTarget) e.currentTarget.classList.add('selected');

    // Recalcular maxCantidadDisponible si ya hay talla seleccionada
    if (selectedTalla && currentStockMap) {
        const key = `${selectedTalla}_${selectedColor}`;
        maxCantidadDisponible = currentStockMap[key] || 0;
        document.getElementById('maxStock').innerText = maxCantidadDisponible;
        selectedCantidad = 1;
        document.getElementById('cantidadValue').innerText = "1";

        if (maxCantidadDisponible <= 5 && maxCantidadDisponible > 0) {
            document.getElementById('stockWarning').style.display = 'block';
            document.getElementById('stockNum').innerText = maxCantidadDisponible;
        } else {
            document.getElementById('stockWarning').style.display = 'none';
        }
    }
}

function selectTalla(talla, e) {
    selectedTalla = talla;
    document.getElementById('tallaSeleccionada').innerText = talla;

    document.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('selected'));
    if (e?.currentTarget) e.currentTarget.classList.add('selected');

    if (selectedColor && currentStockMap) {
        const key = `${talla}_${selectedColor}`;
        maxCantidadDisponible = currentStockMap[key] || 0;
    } else {
        maxCantidadDisponible = 0;
    }

    document.getElementById('maxStock').innerText = maxCantidadDisponible;
    selectedCantidad = 1;
    document.getElementById('cantidadValue').innerText = "1";

    if (maxCantidadDisponible <= 5 && maxCantidadDisponible > 0) {
        document.getElementById('stockWarning').style.display = 'block';
        document.getElementById('stockNum').innerText = maxCantidadDisponible;
    } else {
        document.getElementById('stockWarning').style.display = 'none';
    }
}

function cambiarCantidad(delta) {
    let nueva = selectedCantidad + delta;
    if (nueva < 1) nueva = 1;
    if (nueva > maxCantidadDisponible) nueva = maxCantidadDisponible;
    selectedCantidad = nueva;
    document.getElementById('cantidadValue').innerText = nueva;
}

function addToCartFromModal() {
    if (!selectedColor) { showToast("⚠️ Selecciona un color"); return; }
    if (!selectedTalla) { showToast("⚠️ Selecciona una talla"); return; }
    if (maxCantidadDisponible <= 0) { showToast("❌ Sin stock para esta combinación"); return; }
    if (selectedCantidad > maxCantidadDisponible) {
        showToast(`❌ Solo hay ${maxCantidadDisponible} disponibles`);
        return;
    }

    const itemIndex = cart.findIndex(
        i => i.id === selectedPolo.id && i.color === selectedColor && i.talla === selectedTalla
    );
    if (itemIndex >= 0) {
        cart[itemIndex].cantidad += selectedCantidad;
    } else {
        cart.push({
            id: selectedPolo.id,
            nombre: selectedPolo.nombre,
            precio: parseFloat(selectedPolo.precio),
            color: selectedColor,
            talla: selectedTalla,
            cantidad: selectedCantidad
        });
    }

    updateCartCount();

// Guardar antes del reset
const confirmedColor = selectedColor;
const confirmedTalla = selectedTalla;
const confirmedCantidad = selectedCantidad;
const confirmedNombre = selectedPolo.nombre;

closeModal();

document.getElementById('confirmMessage').innerHTML = 
    `${confirmedCantidad}x ${confirmedNombre}<br><small>${confirmedColor} / Talla ${confirmedTalla}</small>`;
document.getElementById('confirmModalOverlay').classList.add('open');
   } 

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    selectedColor = null;
    selectedTalla = null;
    selectedCantidad = 1;
}

function closeConfirmModalAndContinue() {
    document.getElementById('confirmModalOverlay').classList.remove('open');
}

function goToCartFromConfirm() {
    document.getElementById('confirmModalOverlay').classList.remove('open');
    switchTab('cart');
}

// ==========================
// CARRITO
// ==========================
function renderCart() {
    const container = document.getElementById('cartItemsList');
    const footer = document.getElementById('cartFooter');
    if (!container) return;

    if (!cart.length) {
        container.innerHTML = '<p style="text-align:center;">Tu carrito está vacío</p>';
        if (footer) footer.style.display = 'none';
        return;
    }

    let total = 0;
    container.innerHTML = '<div class="cart-items"></div>';
    const cartDiv = container.querySelector('.cart-items');

    cart.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #ddd;';
        row.innerHTML = `
            <div>
                <strong>${escapeHtml(item.nombre)}</strong><br>
                <small>${escapeHtml(item.color)} / Talla ${escapeHtml(item.talla)}</small>
            </div>
            <div>S/ ${item.precio.toFixed(2)} x ${item.cantidad}</div>
            <div>
                S/ ${subtotal.toFixed(2)}
                <button class="remove-item" data-index="${index}" 
                        style="margin-left:10px; background:#ff4444; color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">
                    ✖
                </button>
            </div>
        `;
        row.querySelector('.remove-item').addEventListener('click', function() {
            removeFromCart(parseInt(this.dataset.index));
        });
        cartDiv.appendChild(row);
    });

    if (footer) {
        footer.style.display = 'block';
        document.getElementById('cartTotalVal').innerText = `Total: S/ ${total.toFixed(2)}`;
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
    updateCartCount();
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').innerText = count;
}

function sendWhatsApp() {
    if (!cart.length) { showToast("Carrito vacío"); return; }

    let mensaje = "🛍️ *NUEVO PEDIDO - POLO STUDIO*%0A%0A";
    let total = 0;
    cart.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• ${item.nombre} (${item.color} / Talla ${item.talla}) x${item.cantidad} = S/ ${subtotal.toFixed(2)}%0A`;
    });
    mensaje += `%0A💰 *TOTAL: S/ ${total.toFixed(2)}*`;
    mensaje += "%0A%0A📦 Gracias por tu compra!";

    window.open(`https://wa.me/940620618?text=${mensaje}`, '_blank');
}

// ==========================
// FILTROS Y BÚSQUEDA
// ==========================
function applyFilters(searchTerm = '', category = 'todas') {
    document.querySelectorAll('.product-card').forEach(card => {
        const texto = card.innerText.toLowerCase();
        const cat = card.dataset.categoria || '';
        const coincideBusqueda = texto.includes(searchTerm);
        const coincideCategoria = category === 'todas' || cat.includes(category);
        card.style.display = coincideBusqueda && coincideCategoria ? '' : 'none';
    });
}

// ==========================
// INICIALIZACIÓN
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();

    // Búsqueda
    document.getElementById('searchInput')?.addEventListener('input', function(e) {
        const activeCat = document.querySelector('.cat-pill.active')?.dataset.cat || 'todas';
        applyFilters(e.target.value.toLowerCase(), activeCat);
    });

    // Filtros por categoría
    document.querySelectorAll('.cat-pill').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const cat = this.dataset.cat;
            const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
            applyFilters(searchTerm, cat);
        });
    });

    // Listeners admin
    document.querySelectorAll('.talla-check').forEach(cb => cb.addEventListener('change', generateStockFields));
    document.getElementById('prodColores')?.addEventListener('input', generateStockFields);

    // Logo secreto para admin
    document.getElementById('secretLogo')?.addEventListener('dblclick', () => {
        document.getElementById('tab-admin').style.display = 'inline-block';
        showToast("🔐 Modo Admin Activado");
    });

    // Cerrar modales al hacer clic fuera
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('confirmModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeConfirmModalAndContinue();
    });
});
