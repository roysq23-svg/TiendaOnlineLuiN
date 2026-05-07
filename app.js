const supabaseUrl = 'https://nbcxafnjolasdmleqjhp.supabase.co';
const supabaseKey = 'sb_publishable_0CmPrpHpz_iz8ZOI04uZ4A_VcNCpncN';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let selectedPolo = null;
let selectedColor = null;
let selectedTalla = null;
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

// GENERAR CAMPOS DE STOCK DINÁMICOS
function generateStockFields() {
    const tallas = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];
    
    const stockFieldsDiv = document.getElementById('stockFields');
    const container = document.getElementById('stockFieldsContainer');
    
    if (tallas.length > 0 && colores.length > 0) {
        container.style.display = 'block';
        stockFieldsDiv.innerHTML = '<table style="width:100%; border-collapse:collapse;">';
        stockFieldsDiv.innerHTML += '<tr><th>Color / Talla</th>' + tallas.map(t => `<th>${t}</th>`).join('') + '</tr>';
        
        colores.forEach(color => {
            stockFieldsDiv.innerHTML += `<tr><td style="background:#f0f0f0; padding:5px;"><strong>${color}</strong></td>`;
            tallas.forEach(talla => {
                const fieldId = `stock_${talla}_${color.replace(/\s/g, '_')}`;
                stockFieldsDiv.innerHTML += `<td style="padding:5px;"><input type="number" id="${fieldId}" value="0" min="0" style="width:70px; padding:5px;"></td>`;
            });
            stockFieldsDiv.innerHTML += '</tr>';
        });
        stockFieldsDiv.innerHTML += '</table>';
    } else {
        container.style.display = 'none';
        stockFieldsDiv.innerHTML = '';
    }
}

// ESCUCHAR CAMBIOS EN TALLAS Y COLORES
document.addEventListener('DOMContentLoaded', () => {
    const tallaChecks = document.querySelectorAll('.talla-check');
    const coloresInput = document.getElementById('prodColores');
    
    tallaChecks.forEach(cb => cb.addEventListener('change', generateStockFields));
    if (coloresInput) coloresInput.addEventListener('input', generateStockFields);
});

// CARGAR TIENDA
async function loadProducts() {
    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) { 
        console.error("Error al cargar productos:", error);
        showToast("❌ Error al cargar productos"); 
        return; 
    }

    const grid = document.getElementById('storeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (!polos || polos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1;">No hay productos disponibles. Agrega desde el panel Admin.</p>';
        return;
    }

    polos.forEach(p => {
        grid.innerHTML += `
            <div class="product-card" onclick='openModal(${JSON.stringify(p)})'>
                <img src="${p.imagen_url || 'https://via.placeholder.com/300?text=Sin+imagen'}" onerror="this.src='https://via.placeholder.com/300?text=Sin+imagen'">
                <div class="product-info">
                    <h3>${escapeHtml(p.nombre)}</h3>
                    <p>S/ ${parseFloat(p.precio).toFixed(2)}</p>
                </div>
            </div>`;
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

// CRUD ADMIN
async function loadInventory() {
    const { data: polos, error } = await _supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) { 
        console.error("Error al cargar inventario:", error);
        showToast("❌ Error al cargar inventario"); 
        return; 
    }

    const list = document.getElementById('adminInventoryList');
    if (!list) return;
    
    list.innerHTML = '';

    if (!polos || polos.length === 0) {
        list.innerHTML = '<p>No hay productos registrados.</p>';
        return;
    }

    for (const p of polos) {
        // Obtener stock para este producto
        const { data: stock } = await _supabase
            .from('polo_stock')
            .select('*')
            .eq('polo_id', p.id);
        
        const stockResume = stock && stock.length > 0 ? 
            `<small style="color:#666;">📦 Stock: ${stock.length} variantes</small>` : 
            `<small style="color:#999;">⚠️ Sin stock configurado</small>`;
        
        list.innerHTML += `
            <div class="inventory-item">
                <img src="${p.imagen_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex-grow:1; margin-left:15px;">
                    <h4 style="font-size:14px;">${escapeHtml(p.nombre)}</h4>
                    <small>S/ ${parseFloat(p.precio).toFixed(2)}</small><br>
                    <small style="color:#888;">${escapeHtml(p.categoria) || 'Sin categoría'}</small><br>
                    ${stockResume}
                </div>
                <button onclick='prepareEdit(${JSON.stringify(p)})' style="color:blue; background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deletePolo(${p.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;">🗑️</button>
            </div>`;
    }
}

async function saveProduct() {
    const id = document.getElementById('editPoloId').value;
    const nombre = document.getElementById('prodName').value.trim();
    const precio = document.getElementById('prodPrice').value;
    const descripcion = document.getElementById('prodDesc').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const file = document.getElementById('imgFileInput').files[0];

    // Tallas seleccionadas
    const tallasChecked = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);

    // Colores ingresados
    const coloresRaw = document.getElementById('prodColores').value.trim();
    const colores = coloresRaw ? coloresRaw.split(',').map(c => c.trim()).filter(c => c) : [];

    if (!nombre || !precio) return showToast("⚠️ Llena nombre y precio");
    if (tallasChecked.length === 0) return showToast("⚠️ Selecciona al menos una talla");
    if (colores.length === 0) return showToast("⚠️ Ingresa al menos un color");

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerText;
    btn.innerText = "PROCESANDO...";
    btn.disabled = true;

    let updateData = {
        nombre,
        precio: parseFloat(precio),
        descripcion,
        categoria,
        tallas: tallasChecked,
        colores: colores
    };

    // Subir imagen si hay archivo
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

    let poloId = id;
    let error;

    if (id) {
        const res = await _supabase.from('polos').update(updateData).eq('id', id);
        error = res.error;
        if (!error) poloId = parseInt(id);
    } else {
        const res = await _supabase.from('polos').insert([updateData]).select();
        error = res.error;
        if (!error && res.data && res.data.length > 0) {
            poloId = res.data[0].id;
        }
    }

    if (error) {
        showToast("❌ Error: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    // Guardar stock por talla y color
    if (poloId && tallasChecked.length > 0 && colores.length > 0) {
        for (const talla of tallasChecked) {
            for (const color of colores) {
                const stockInput = document.getElementById(`stock_${talla}_${color.replace(/\s/g, '_')}`);
                const cantidad = stockInput ? parseInt(stockInput.value) || 0 : 0;
                
                await _supabase.from('polo_stock').upsert({
                    polo_id: poloId,
                    talla,
                    color,
                    cantidad
                }, { onConflict: 'polo_id,talla,color' });
            }
        }
    }

    showToast(id ? "✅ Polo actualizado" : "✅ Polo agregado");
    resetForm();
    loadProducts();
    loadInventory();

    btn.innerText = originalText;
    btn.disabled = false;
}

async function deletePolo(id) {
    if (!confirm("¿Eliminar polo? Esto también eliminará su stock.")) return;
    
    // Eliminar stock primero
    await _supabase.from('polo_stock').delete().eq('polo_id', id);
    
    // Eliminar producto
    const { error } = await _supabase.from('polos').delete().eq('id', id);
    
    if (error) {
        showToast("❌ Error al eliminar: " + error.message);
    } else {
        showToast("🗑️ Eliminado");
        loadInventory();
        loadProducts();
    }
}

async function prepareEdit(polo) {
    document.getElementById('formTitle').innerText = "Editando Polo";
    document.getElementById('editPoloId').value = polo.id;
    document.getElementById('prodName').value = polo.nombre;
    document.getElementById('prodPrice').value = polo.precio;
    document.getElementById('prodDesc').value = polo.descripcion || '';
    document.getElementById('prodCategoria').value = polo.categoria || 'Básico';
    document.getElementById('prodColores').value = (polo.colores || []).join(', ');
    document.getElementById('fileLabel').innerHTML = "📷 Seleccionar nueva imagen (opcional)";
    document.getElementById('cancelEdit').style.display = 'block';

    // Marcar tallas
    document.querySelectorAll('.talla-check').forEach(cb => {
        cb.checked = (polo.tallas || []).includes(cb.value);
    });
    
    // Generar campos de stock y cargar valores existentes
    generateStockFields();
    
    // Cargar stock existente
    setTimeout(async () => {
        const { data: stockData } = await _supabase
            .from('polo_stock')
            .select('*')
            .eq('polo_id', polo.id);
        
        if (stockData) {
            stockData.forEach(stock => {
                const fieldId = `stock_${stock.talla}_${stock.color.replace(/\s/g, '_')}`;
                const field = document.getElementById(fieldId);
                if (field) field.value = stock.cantidad;
            });
        }
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
    document.getElementById('prodColores').value = "";
    document.getElementById('imgFileInput').value = "";
    document.getElementById('fileLabel').innerHTML = "📷 Seleccionar Imagen";
    document.getElementById('cancelEdit').style.display = 'none';
    document.querySelectorAll('.talla-check').forEach(cb => cb.checked = false);
    document.getElementById('stockFieldsContainer').style.display = 'none';
    document.getElementById('stockFields').innerHTML = '';
}

// MODAL CON TALLAS Y COLORES
async function openModal(polo) {
    selectedPolo = polo;
    selectedColor = null;
    selectedTalla = null;
    currentStockData = [];

    document.getElementById('modalImg').src = polo.imagen_url || 'https://via.placeholder.com/300';
    document.getElementById('modalName').innerText = polo.nombre;
    document.getElementById('modalPrice').innerText = "S/ " + parseFloat(polo.precio).toFixed(2);
    document.getElementById('modalDesc').innerText = polo.descripcion || "Calidad Premium.";
    document.getElementById('modalCategoria').innerText = polo.categoria || "Básico";
    document.getElementById('colorSeleccionado').innerText = "—";
    document.getElementById('tallaSeleccionada').innerText = "—";
    document.getElementById('stockWarning').style.display = 'none';
    
    // Cargar stock desde supabase
    const { data: stockData } = await _supabase
        .from('polo_stock')
        .select('*')
        .eq('polo_id', polo.id);
    
    currentStockData = stockData || [];
    
    // Renderizar colores
    const colorOptions = document.getElementById('colorOptions');
    colorOptions.innerHTML = '';
    
    const colores = polo.colores || [];
    colores.forEach(color => {
        const hasStock = currentStockData.some(s => s.color === color && s.cantidad > 0);
        colorOptions.innerHTML += `
            <div class="color-circle ${!hasStock ? 'sin-stock' : ''}" 
                 style="background-color: ${getColorCode(color)};"
                 onclick="${hasStock ? `selectColor('${color}')` : ''}"
                 title="${color} ${!hasStock ? '(Sin stock)' : ''}">
            </div>
        `;
    });
    
    document.getElementById('modalOverlay').classList.add('open');
}

function getColorCode(color) {
    const colors = {
        'Rojo': '#FF0000',
        'Azul': '#0000FF',
        'Negro': '#000000',
        'Blanco': '#FFFFFF',
        'Verde': '#00FF00',
        'Amarillo': '#FFFF00',
        'Gris': '#808080',
        'Rosa': '#FFC0CB',
        'Morado': '#800080',
        'Naranja': '#FFA500'
    };
    return colors[color] || '#CCCCCC';
}

function selectColor(color) {
    selectedColor = color;
    selectedTalla = null;
    document.getElementById('colorSeleccionado').innerText = color;
    document.getElementById('tallaSeleccionada').innerText = "—";
    
    // Filtrar tallas disponibles para este color
    const tallasDisponibles = currentStockData
        .filter(s => s.color === color && s.cantidad > 0)
        .map(s => ({ talla: s.talla, stock: s.cantidad }));
    
    const tallaOptions = document.getElementById('tallaOptions');
    tallaOptions.innerHTML = '';
    
    const todasLasTallas = selectedPolo.tallas || ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    todasLasTallas.forEach(talla => {
        const stockInfo = tallasDisponibles.find(t => t.talla === talla);
        const tieneStock = stockInfo && stockInfo.stock > 0;
        const stockCantidad = stockInfo ? stockInfo.stock : 0;
        
        tallaOptions.innerHTML += `
            <button class="talla-btn ${!tieneStock ? 'sin-stock' : ''}"
                    onclick="${tieneStock ? `selectTalla('${talla}', ${stockCantidad})` : ''}"
                    ${!tieneStock ? 'disabled' : ''}>
                ${talla} ${tieneStock ? `(${stockCantidad})` : '(Agotado)'}
            </button>
        `;
    });
}

function selectTalla(talla, stock) {
    selectedTalla = talla;
    document.getElementById('tallaSeleccionada').innerText = `${talla} (${stock} disponibles)`;
    
    if (stock <= 5) {
        document.getElementById('stockWarning').style.display = 'block';
        document.getElementById('stockNum').innerText = stock;
    } else {
        document.getElementById('stockWarning').style.display = 'none';
    }
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
    
    // Verificar stock nuevamente
    const stockItem = currentStockData.find(
        s => s.color === selectedColor && s.talla === selectedTalla
    );
    
    if (!stockItem || stockItem.cantidad <= 0) {
        showToast("❌ Sin stock disponible");
        return;
    }
    
    // Buscar si ya existe en el carrito (mismo producto, color y talla)
    const existingIndex = cart.findIndex(
        item => item.id === selectedPolo.id && 
                item.color === selectedColor && 
                item.talla === selectedTalla
    );
    
    if (existingIndex !== -1) {
        cart[existingIndex].cantidad++;
    } else {
        cart.push({
            id: selectedPolo.id,
            nombre: selectedPolo.nombre,
            precio: parseFloat(selectedPolo.precio),
            color: selectedColor,
            talla: selectedTalla,
            cantidad: 1
        });
    }
    
    updateCartCount();
    showToast(`✅ Añadido: ${selectedPolo.nombre} - ${selectedColor} - Talla ${selectedTalla}`);
    closeModal();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    selectedColor = null;
    selectedTalla = null;
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
    
    window.open(`https://wa.me/51987654321?text=${mensaje}`, '_blank');
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
    
    // Mostrar admin con doble clic en logo
    const logo = document.getElementById('secretLogo');
    if (logo) {
        logo.addEventListener('dblclick', () => {
            const adminBtn = document.getElementById('tab-admin');
            if (adminBtn) adminBtn.style.display = 'inline-block';
            showToast("🔐 Modo Admin Activado");
        });
    }
    
    // Cerrar modal al hacer clic fuera
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }
});
