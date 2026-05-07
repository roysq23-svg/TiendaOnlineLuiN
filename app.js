const supabaseUrl = 'https://nbcxafnjolasdmleqjhp.supabase.co';
const supabaseKey = 'sb_publishable_0CmPrpHpz_iz8ZOI04uZ4A_VcNCpncN';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let selectedPolo = null;
let selectedColor = null;
let selectedTalla = null;
let selectedCantidad = 1;
let maxCantidadDisponible = 0;
let currentStockData = [];

// NAVEGACIÓN
function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('panel-' + tabId);
    if (target) target.classList.add('active');
    if (tabId === 'admin') loadInventory();
    if (tabId === 'cart') renderCart();
    window.scrollTo(0, 0);
}

// ACTUALIZAR LABEL DE IMAGEN
function updateLabel() {
    const file = document.getElementById('imgFileInput').files[0];
    const label = document.getElementById('fileLabel');
    if (file) {
        label.innerHTML = `📷 ${file.name}`;
    } else {
        label.innerHTML = "📷 Seleccionar Imagen";
    }
}

// CARGAR TIENDA
async function loadProducts() {
    console.log("Cargando productos...");
    
    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) { 
        console.error("Error al cargar productos:", error);
        showToast("❌ Error al cargar productos: " + error.message); 
        return; 
    }

    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (!polos || polos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1;">No hay productos disponibles. Agrega desde el panel Admin.</p>';
        return;
    }

    console.log("Productos cargados:", polos.length);

    polos.forEach(p => {
        const stockActual = p.stock || 0;
        
        grid.innerHTML += `
            <div class="product-card" onclick='openModal(${JSON.stringify(p)})'>
                <img src="${p.imagen_url || 'https://via.placeholder.com/300?text=Sin+imagen'}" onerror="this.src='https://via.placeholder.com/300?text=Sin+imagen'">
                <div class="product-info">
                    <h3>${escapeHtml(p.nombre)}</h3>
                    <p>S/ ${parseFloat(p.precio).toFixed(2)}</p>
                    ${stockActual > 0 ? `<small style="color:green;">✅ ${stockActual} unidades</small>` : `<small style="color:red;">❌ Agotado</small>`}
                </div>
            </div>
        `;
    });
}

// ESCAPE HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// OBTENER CÓDIGO DE COLOR MEJORADO
function getColorCode(color) {
    const colors = {
        'Rojo': '#FF0000',
        'Azul': '#0000FF',
        'Negro': '#000000',
        'Blanco': '#F0F0F0',
        'Verde': '#00FF00',
        'Amarillo': '#FFFF00',
        'Gris': '#999999',
        'Rosa': '#FFC0CB',
        'Morado': '#800080',
        'Naranja': '#FFA500',
        'Celeste': '#87CEEB',
        'Marrón': '#8B4513',
        'Beige': '#F5F5DC',
        'Plateado': '#C0C0C0',
        'Dorado': '#FFD700'
    };
    
    return colors[color] || '#CCCCCC';
}

// CRUD ADMIN
async function loadInventory() {
    console.log("Cargando inventario...");
    
    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) { 
        console.error("Error al cargar inventario:", error);
        showToast("❌ Error al cargar inventario: " + error.message); 
        return; 
    }

    const list = document.getElementById('adminInventoryList');
    if (!list) return;
    
    list.innerHTML = '';

    if (!polos || polos.length === 0) {
        list.innerHTML = '<p>No hay productos registrados.</p>';
        return;
    }

    console.log("Inventario cargado:", polos.length);

    polos.forEach(p => {
        list.innerHTML += `
            <div class="inventory-item">
                <img src="${p.imagen_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex-grow:1; margin-left:15px;">
                    <h4 style="font-size:14px;">${escapeHtml(p.nombre)}</h4>
                    <small>S/ ${parseFloat(p.precio).toFixed(2)}</small><br>
                    <small style="color:#888;">${escapeHtml(p.categoria) || 'Sin categoría'}</small><br>
                    <small style="color:${(p.stock || 0) > 0 ? 'green' : 'red'};">📦 Stock: ${p.stock || 0} unidades</small>
                </div>
                <button onclick='prepareEdit(${JSON.stringify(p)})' style="color:blue; background:none; border:none; cursor:pointer; font-size:20px;">✏️</button>
                <button onclick="deletePolo(${p.id})" style="color:red; background:none; border:none; cursor:pointer; font-size:20px; margin-left:10px;">🗑️</button>
            </div>
        `;
    });
}

// GENERAR CAMPOS DE STOCK DINÁMICOS
function generateStockFields() {
    const tallas = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];
    
    const stockFieldsDiv = document.getElementById('stockFields');
    const container = document.getElementById('stockFieldsContainer');
    
    if (!stockFieldsDiv || !container) return;
    
    if (tallas.length > 0 && colores.length > 0) {
        container.style.display = 'block';
        stockFieldsDiv.innerHTML = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
        stockFieldsDiv.innerHTML += '<tr><th style="padding:8px; background:#0a0a0a; color:white;">Color / Talla</th>' + tallas.map(t => `<th style="padding:8px; background:#0a0a0a; color:white;">${t}</th>`).join('') + '</tr>';
        
        colores.forEach(color => {
            stockFieldsDiv.innerHTML += `<tr><td style="background:#f0f0f0; padding:8px;"><strong>${color}</strong></tr>`;
            tallas.forEach(talla => {
                const fieldId = `stock_${talla}_${color.replace(/\s/g, '_')}`;
                stockFieldsDiv.innerHTML += `<td style="padding:5px;"><input type="number" id="${fieldId}" value="0" min="0" style="width:70px; padding:5px; text-align:center;"></td>`;
            });
            stockFieldsDiv.innerHTML += '</tr>';
        });
        stockFieldsDiv.innerHTML += '</table>';
    } else {
        container.style.display = 'none';
        stockFieldsDiv.innerHTML = '';
    }
}

async function saveProduct() {
    const id = document.getElementById('editPoloId').value;
    const nombre = document.getElementById('prodName').value.trim();
    const precio = document.getElementById('prodPrice').value;
    const descripcion = document.getElementById('prodDesc').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;
    const file = document.getElementById('imgFileInput').files[0];

    const tallasChecked = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];

    if (!nombre || !precio) {
        showToast("⚠️ Llena nombre y precio");
        return;
    }
    
    if (tallasChecked.length === 0) {
        showToast("⚠️ Selecciona al menos una talla");
        return;
    }
    
    if (colores.length === 0) {
        showToast("⚠️ Ingresa al menos un color");
        return;
    }

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerText;
    btn.innerText = "PROCESANDO...";
    btn.disabled = true;

    let updateData = {
        nombre,
        precio: parseFloat(precio),
        descripcion,
        categoria,
        stock: stock,
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
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        const { data: urlData } = _supabase.storage
            .from('imagenes-polos')
            .getPublicUrl(fileName);

        updateData.imagen_url = urlData.publicUrl;
    }

    let error;

    if (id) {
        const res = await _supabase.from('polos').update(updateData).eq('id', id);
        error = res.error;
        if (!error) {
            showToast("✅ Polo actualizado correctamente");
        }
    } else {
        const res = await _supabase.from('polos').insert([updateData]).select();
        error = res.error;
        if (!error && res.data && res.data.length > 0) {
            showToast("✅ Polo agregado correctamente");
        }
    }

    if (error) {
        showToast("❌ Error: " + error.message);
        console.error("Error guardando:", error);
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    await loadProducts();
    await loadInventory();
    
    resetForm();
    btn.innerText = originalText;
    btn.disabled = false;
}

async function deletePolo(id) {
    if (!confirm("¿Eliminar este producto permanentemente?")) return;
    
    const { error } = await _supabase.from('polos').delete().eq('id', id);
    
    if (error) {
        showToast("❌ Error al eliminar: " + error.message);
        console.error("Error eliminando:", error);
    } else {
        showToast("🗑️ Producto eliminado");
        await loadInventory();
        await loadProducts();
    }
}

async function prepareEdit(polo) {
    console.log("Editando producto:", polo);
    
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

async function loadExistingStocks(poloId) {
    const { data: stocks } = await _supabase
        .from('polo_stock')
        .select('*')
        .eq('polo_id', poloId);
    
    if (stocks) {
        stocks.forEach(stock => {
            const fieldId = `stock_${stock.talla}_${stock.color.replace(/\s/g, '_')}`;
            const field = document.getElementById(fieldId);
            if (field) field.value = stock.cantidad;
        });
    }
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

// MODAL PRINCIPAL
async function openModal(polo) {
    console.log("Abriendo modal de:", polo.nombre);
    
    selectedPolo = polo;
    selectedColor = null;
    selectedTalla = null;
    selectedCantidad = 1;
    maxCantidadDisponible = polo.stock || 0;

    document.getElementById('modalImg').src = polo.imagen_url || 'https://via.placeholder.com/300';
    document.getElementById('modalName').innerText = polo.nombre;
    document.getElementById('modalPrice').innerText = "S/ " + parseFloat(polo.precio).toFixed(2);
    document.getElementById('modalDesc').innerText = polo.descripcion || "Calidad Premium.";
    document.getElementById('modalCategoria').innerText = polo.categoria || "Básico";
    document.getElementById('colorSeleccionado').innerText = "—";
    document.getElementById('tallaSeleccionada').innerText = "—";
    document.getElementById('stockWarning').style.display = 'none';
    document.getElementById('cantidadValue').innerText = "1";
    document.getElementById('maxStock').innerText = polo.stock || 0;
    
    const colorOptions = document.getElementById('colorOptions');
    colorOptions.innerHTML = '';
    
    const colores = polo.colores || ['Blanco', 'Negro'];
    colores.forEach(color => {
        const colorDiv = document.createElement('div');
        colorDiv.style.textAlign = 'center';
        colorDiv.innerHTML = `
            <div class="color-circle" 
                 style="background-color: ${getColorCode(color)};"
                 onclick="selectColor('${color}')"
                 title="${color}">
            </div>
            <small style="font-size: 10px; display: block; margin-top: 4px;">${color}</small>
        `;
        colorOptions.appendChild(colorDiv);
    });
    
    const tallaOptions = document.getElementById('tallaOptions');
    tallaOptions.innerHTML = '';
    
    const tallas = polo.tallas || ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    tallas.forEach(talla => {
        const btn = document.createElement('button');
        btn.className = 'talla-btn';
        btn.innerText = `${talla} (${polo.stock || 0})`;
        btn.onclick = () => selectTalla(talla, polo.stock || 0);
        tallaOptions.appendChild(btn);
    });
    
    document.getElementById('modalOverlay').classList.add('open');
}

function selectColor(color) {
    selectedColor = color;
    document.getElementById('colorSeleccionado').innerText = color;
    
    document.querySelectorAll('.color-circle').forEach(circle => {
        circle.classList.remove('selected');
    });
    
    if (event && event.target) {
        event.target.classList.add('selected');
    }
}

function selectTalla(talla, stock) {
    selectedTalla = talla;
    maxCantidadDisponible = stock;
    selectedCantidad = 1;
    
    document.getElementById('tallaSeleccionada').innerText = `${talla} (${stock} disponibles)`;
    document.getElementById('maxStock').innerText = stock;
    document.getElementById('cantidadValue').innerText = "1";
    
    document.querySelectorAll('.talla-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (event && event.target) {
        event.target.classList.add('selected');
    }
    
    if (stock <= 5 && stock > 0) {
        document.getElementById('stockWarning').style.display = 'block';
        document.getElementById('stockNum').innerText = stock;
    } else {
        document.getElementById('stockWarning').style.display = 'none';
    }
}

function cambiarCantidad(delta) {
    let nuevaCantidad = selectedCantidad + delta;
    
    if (nuevaCantidad < 1) nuevaCantidad = 1;
    if (nuevaCantidad > maxCantidadDisponible) nuevaCantidad = maxCantidadDisponible;
    
    selectedCantidad = nuevaCantidad;
    document.getElementById('cantidadValue').innerText = selectedCantidad;
}

function addToCartFromModal() {
    if (!selectedColor) {
        showToast("⚠️ Selecciona un color");
        return;
    }
    if (!selectedTalla) {
        showToast("⚠️ Selecciona una talla");
        return;
    }
    
    if (selectedPolo.stock <= 0) {
        showToast("❌ Sin stock disponible");
        return;
    }
    
    if (selectedCantidad > selectedPolo.stock) {
        showToast(`❌ Solo hay ${selectedPolo.stock} unidades disponibles`);
        return;
    }
    
    const existingIndex = cart.findIndex(
        item => item.id === selectedPolo.id && 
                item.color === selectedColor && 
                item.talla === selectedTalla
    );
    
    if (existingIndex !== -1) {
        cart[existingIndex].cantidad += selectedCantidad;
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
    closeModal();
    
    const confirmMsg = document.getElementById('confirmMessage');
    if (confirmMsg) {
        confirmMsg.innerHTML = `${selectedCantidad}x ${selectedPolo.nombre}<br><small>${selectedColor} / Talla ${selectedTalla}</small>`;
    }
    const confirmModal = document.getElementById('confirmModalOverlay');
    if (confirmModal) {
        confirmModal.classList.add('open');
    }
}

function closeModal() {
    const modal = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('open');
    selectedColor = null;
    selectedTalla = null;
    selectedCantidad = 1;
}

function closeConfirmModalAndContinue() {
    const confirmModal = document.getElementById('confirmModalOverlay');
    if (confirmModal) confirmModal.classList.remove('open');
}

function goToCartFromConfirm() {
    const confirmModal = document.getElementById('confirmModalOverlay');
    if (confirmModal) confirmModal.classList.remove('open');
    switchTab('cart');
}

function renderCart() {
    const container = document.getElementById('cartItemsList');
    const footer = document.getElementById('cartFooter');
    
    if (!container) return;
    
    if (!cart || cart.length === 0) {
        container.innerHTML = '<p style="text-align:center;">Tu carrito está vacío</p>';
        if (footer) footer.style.display = 'none';
        return;
    }
    
    let total = 0;
    container.innerHTML = '<div class="cart-items"></div>';
    const cartItemsDiv = container.querySelector('.cart-items');
    
    cart.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        cartItemsDiv.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #ddd;">
                <div>
                    <strong>${escapeHtml(item.nombre)}</strong><br>
                    <small>${item.color} / Talla ${item.talla}</small>
                </div>
                <div>
                    S/ ${item.precio.toFixed(2)} x ${item.cantidad}
                </div>
                <div>
                    S/ ${subtotal.toFixed(2)}
                    <button onclick="removeFromCart(${index})" style="margin-left:10px; background:#ff4444; color:white; border:none; border-radius:5px; padding:5px 10px; cursor:pointer;">✖</button>
                </div>
            </div>
        `;
    });
    
    if (footer) {
        footer.style.display = 'block';
        const totalEl = document.getElementById('cartTotalVal');
        if (totalEl) totalEl.innerText = `Total: S/ ${total.toFixed(2)}`;
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
    updateCartCount();
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
    const cartCountSpan = document.getElementById('cart-count');
    if (cartCountSpan) cartCountSpan.innerText = count;
}

function sendWhatsApp() {
    if (!cart.length) {
        showToast("Carrito vacío");
        return;
    }
    
    let mensaje = "🛍️ *NUEVO PEDIDO - POLO STUDIO*%0A%0A";
    let total = 0;
    
    cart.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• ${item.nombre} (${item.color} / Talla ${item.talla}) x${item.cantidad} = S/ ${subtotal.toFixed(2)}%0A`;
    });
    
    mensaje += `%0A💰 *TOTAL: S/ ${total.toFixed(2)}*`;
    mensaje += "%0A%0A📦 Gracias por tu compra!";
    
    window.open(`https://wa.me/912334187?text=${mensaje}`, '_blank');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// INICIALIZAR
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    
    const tallaChecks = document.querySelectorAll('.talla-check');
    const coloresInput = document.getElementById('prodColores');
    
    if (tallaChecks.length > 0) {
        tallaChecks.forEach(cb => cb.addEventListener('change', generateStockFields));
    }
    if (coloresInput) {
        coloresInput.addEventListener('input', generateStockFields);
    }
    
    const logo = document.getElementById('secretLogo');
    if (logo) {
        logo.addEventListener('dblclick', () => {
            const adminBtn = document.getElementById('tab-admin');
            if (adminBtn) adminBtn.style.display = 'inline-block';
            showToast("🔐 Modo Admin Activado");
        });
    }
    
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }
    
    const confirmModalOverlay = document.getElementById('confirmModalOverlay');
    if (confirmModalOverlay) {
        confirmModalOverlay.addEventListener('click', (e) => {
            if (e.target === confirmModalOverlay) closeConfirmModalAndContinue();
        });
    }
});
