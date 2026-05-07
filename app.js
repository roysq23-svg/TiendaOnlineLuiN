// ==================== CONFIGURACIÓN SUPABASE ====================
const SUPABASE_URL = 'https://nbcxafnjolasdmleqjhp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0CmPrpHpz_iz8ZOI04uZ4A_VcNCpncN';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cart = [];
let selectedPolo = null;
let selectedColor = null;
let selectedTalla = null;
let selectedCantidad = 1;

// ==================== NAVEGACIÓN ====================
function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('panel-' + tabId);
    if (target) target.classList.add('active');

    if (tabId === 'admin') loadInventory();
    if (tabId === 'cart') renderCart();
    window.scrollTo(0, 0);
}

// ==================== UTILIDADES ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ==================== CARGAR PRODUCTOS ====================
async function loadProducts() {
    const grid = document.getElementById('storeGrid');
    grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; padding:50px;">Cargando productos...</p>';

    const { data: polos, error } = await supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p style="text-align:center; color:red;">Error al cargar los productos</p>';
        return;
    }

    grid.innerHTML = '';
    if (!polos || polos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1;">No hay productos disponibles. Agrega desde el panel Admin.</p>';
        return;
    }

    polos.forEach(p => {
        grid.innerHTML += `
            <div class="product-card" onclick='openModal(${JSON.stringify(p)})'>
                <img src="${p.imagen_url || 'https://via.placeholder.com/300?text=Sin+imagen'}" 
                     onerror="this.src='https://via.placeholder.com/300?text=Sin+imagen'">
                <div class="product-info">
                    <h3>${escapeHtml(p.nombre)}</h3>
                    <p class="price">S/ ${parseFloat(p.precio).toFixed(2)}</p>
                    ${(p.stock || 0) > 0 ? 
                        `<small style="color:green;">✅ En stock</small>` : 
                        `<small style="color:red;">❌ Agotado</small>`}
                </div>
            </div>
        `;
    });
}

// ==================== PANEL ADMIN ====================
async function loadInventory() {
    const list = document.getElementById('adminInventoryList');
    list.innerHTML = '<p>Cargando inventario...</p>';

    const { data: polos, error } = await supabase
        .from('polos')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        list.innerHTML = '<p>Error al cargar inventario</p>';
        return;
    }

    list.innerHTML = '';
    if (!polos || polos.length === 0) {
        list.innerHTML = '<p>No hay productos registrados.</p>';
        return;
    }

    polos.forEach(p => {
        list.innerHTML += `
            <div class="inventory-item">
                <img src="${p.imagen_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex-grow:1; margin-left:15px;">
                    <h4>${escapeHtml(p.nombre)}</h4>
                    <small>S/ ${parseFloat(p.precio).toFixed(2)}</small><br>
                    <small>${escapeHtml(p.categoria || '')}</small><br>
                    <small style="color:${(p.stock || 0) > 0 ? 'green' : 'red'};">Stock: ${p.stock || 0}</small>
                </div>
                <button onclick='prepareEdit(${JSON.stringify(p)})' style="font-size:22px; background:none; border:none; cursor:pointer;">✏️</button>
                <button onclick="deletePolo(${p.id})" style="font-size:22px; background:none; border:none; cursor:pointer; color:red; margin-left:8px;">🗑️</button>
            </div>
        `;
    });
}

async function saveProduct() {
    const id = document.getElementById('editPoloId').value;
    const nombre = document.getElementById('prodName').value.trim();
    const precio = parseFloat(document.getElementById('prodPrice').value);
    const descripcion = document.getElementById('prodDesc').value.trim();
    const categoria = document.getElementById('prodCategoria').value;
    const stock = parseInt(document.getElementById('prodStock').value) || 0;
    const file = document.getElementById('imgFileInput').files[0];

    const tallas = [...document.querySelectorAll('.talla-check:checked')].map(cb => cb.value);
    const colores = document.getElementById('prodColores').value.split(',').map(c => c.trim()).filter(c => c);

    if (!nombre || !precio || tallas.length === 0 || colores.length === 0) {
        showToast("⚠️ Completa todos los campos obligatorios");
        return;
    }

    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerText;
    btn.innerText = "GUARDANDO...";
    btn.disabled = true;

    let updateData = { nombre, precio, descripcion, categoria, stock, tallas, colores };

    if (file) {
        const fileName = `polo_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
            .from('imagenes-polos')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            showToast("❌ Error al subir imagen");
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }

        const { data: urlData } = supabase.storage.from('imagenes-polos').getPublicUrl(fileName);
        updateData.imagen_url = urlData.publicUrl;
    }

    let error;
    if (id) {
        const res = await supabase.from('polos').update(updateData).eq('id', id);
        error = res.error;
    } else {
        const res = await supabase.from('polos').insert([updateData]);
        error = res.error;
    }

    if (error) {
        showToast("❌ Error: " + error.message);
    } else {
        showToast(id ? "✅ Producto actualizado" : "✅ Producto agregado");
        resetForm();
        await loadProducts();
        await loadInventory();
    }

    btn.innerText = originalText;
    btn.disabled = false;
}

async function deletePolo(id) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;

    const { error } = await supabase.from('polos').delete().eq('id', id);
    if (error) {
        showToast("❌ Error al eliminar");
    } else {
        showToast("🗑️ Producto eliminado");
        await loadProducts();
        await loadInventory();
    }
}

function prepareEdit(polo) {
    document.getElementById('formTitle').innerText = "Editar Polo";
    document.getElementById('editPoloId').value = polo.id;
    document.getElementById('prodName').value = polo.nombre || '';
    document.getElementById('prodPrice').value = polo.precio || '';
    document.getElementById('prodDesc').value = polo.descripcion || '';
    document.getElementById('prodCategoria').value = polo.categoria || 'Básico';
    document.getElementById('prodStock').value = polo.stock || 0;
    document.getElementById('prodColores').value = (polo.colores || []).join(', ');

    document.querySelectorAll('.talla-check').forEach(cb => {
        cb.checked = (polo.tallas || []).includes(cb.value);
    });

    document.getElementById('cancelEdit').style.display = 'block';
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
}

// ==================== MODAL Y CARRITO ====================
function openModal(polo) {
    selectedPolo = polo;
    selectedColor = null;
    selectedTalla = null;
    selectedCantidad = 1;

    document.getElementById('modalImg').src = polo.imagen_url || '';
    document.getElementById('modalName').innerText = polo.nombre;
    document.getElementById('modalPrice').innerText = "S/ " + parseFloat(polo.precio).toFixed(2);
    document.getElementById('modalDesc').innerText = polo.descripcion || "";
    document.getElementById('modalCategoria').innerText = polo.categoria || "";

    // Colores
    const colorDiv = document.getElementById('colorOptions');
    colorDiv.innerHTML = '';
    (polo.colores || []).forEach(color => {
        const el = document.createElement('div');
        el.innerHTML = `<div class="color-circle" style="background-color:${getColorCode(color)}" onclick="selectColor('${color}')"></div><small>${color}</small>`;
        colorDiv.appendChild(el);
    });

    // Tallas
    const tallaDiv = document.getElementById('tallaOptions');
    tallaDiv.innerHTML = '';
    (polo.tallas || []).forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'talla-btn';
        btn.textContent = t;
        btn.onclick = () => selectTalla(t);
        tallaDiv.appendChild(btn);
    });

    document.getElementById('modalOverlay').classList.add('open');
}

function getColorCode(color) {
    const map = {'Rojo':'#e74c3c','Azul':'#3498db','Negro':'#2c3e50','Blanco':'#ecf0f1','Verde':'#2ecc71'};
    return map[color] || '#95a5a6';
}

function selectColor(color) { selectedColor = color; document.getElementById('colorSeleccionado').innerText = color; }
function selectTalla(talla) { selectedTalla = talla; document.getElementById('tallaSeleccionada').innerText = talla; }

function cambiarCantidad(delta) {
    selectedCantidad = Math.max(1, selectedCantidad + delta);
    document.getElementById('cantidadValue').innerText = selectedCantidad;
}

function addToCartFromModal() {
    if (!selectedColor || !selectedTalla) {
        showToast("Selecciona color y talla");
        return;
    }

    const existingIndex = cart.findIndex(item => 
        item.id === selectedPolo.id && 
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
    showToast("✅ Añadido al carrito");
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ==================== CARRITO ====================
function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('cart-count').innerText = count;
}

function renderCart() {
    const container = document.getElementById('cartItemsList');
    const footer = document.getElementById('cartFooter');

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:60px 20px;">Tu carrito está vacío</p>';
        footer.style.display = 'none';
        return;
    }

    let total = 0;
    let html = '';

    cart.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        html += `
            <div class="cart-item">
                <div>
                    <strong>${escapeHtml(item.nombre)}</strong><br>
                    <small>${item.color} • ${item.talla} × ${item.cantidad}</small>
                </div>
                <div style="text-align:right;">
                    S/ ${subtotal.toFixed(2)}
                    <button onclick="removeFromCart(${index})" style="color:red;margin-left:15px;">✕</button>
                </div>
            </div>`;
    });

    container.innerHTML = html;
    footer.style.display = 'block';
    document.getElementById('cartTotalVal').innerText = `Total: S/ ${total.toFixed(2)}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
    updateCartCount();
}

function sendWhatsApp() {
    if (cart.length === 0) return;

    let mensaje = "🛍️ *NUEVO PEDIDO - POLO STUDIO*%0A%0A";
    let total = 0;

    cart.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `• ${item.nombre} (${item.color} / ${item.talla}) x${item.cantidad} = S/ ${subtotal.toFixed(2)}%0A`;
    });

    mensaje += `%0A💰 *TOTAL: S/ ${total.toFixed(2)}*`;
    window.open(`https://wa.me/912334187?text=${mensaje}`, '_blank');
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();

    // Activar Admin con doble clic en el logo
    const logo = document.getElementById('mainLogo');
    if (logo) {
        logo.addEventListener('dblclick', () => {
            document.getElementById('tab-admin').style.display = 'inline-block';
            showToast("🔐 Modo Admin Activado");
        });
    }
});
