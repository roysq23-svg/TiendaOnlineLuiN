const supabaseUrl = 'https://nbcxafnjolasdmleqjhp.supabase.co';
const supabaseKey = 'sb_publishable_0CmPrpHpz_iz8ZOI04uZ4A_VcNCpncN';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let cart = [];
let selectedPolo = null;
let selectedColor = null;
let selectedTalla = null;
let currentStock = [];
let secretClicks = 0;

// NAVEGACIÓN
function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('panel-' + tabId);
    if (target) target.classList.add('active');
    if (tabId === 'admin') loadInventory();
    if (tabId === 'cart') renderCart();
    window.scrollTo(0, 0);
}

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

// Función auxiliar para evitar XSS
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

    polos.forEach(p => {
        list.innerHTML += `
            <div class="inventory-item">
                <img src="${p.imagen_url || 'https://via.placeholder.com/50'}" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex-grow:1; margin-left:15px;">
                    <h4 style="font-size:14px;">${escapeHtml(p.nombre)}</h4>
                    <small>S/ ${parseFloat(p.precio).toFixed(2)}</small><br>
                    <small style="color:#888;">${escapeHtml(p.categoria) || 'Sin categoría'}</small>
                </div>
                <button onclick='prepareEdit(${JSON.stringify(p)})' style="color:blue; background:none; border:none; cursor:pointer;">Editar</button>
                <button onclick="deletePolo(${p.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;">Borrar</button>
            </div>`;
    });
}

async function saveProduct() {
    const id = document.getElementById('editPoloId').value;
    const nombre = document.getElementById('prodName').value.trim();
    const precio = document.getElementById('prodPrice').value;
    const descripcion = document.getElementById('prodDesc').value.trim();
    const categoria = document.getElementById('prodCategoria')?.value || 'Básico';
    const file = document.getElementById('imgFileInput').files[0];

    if (!nombre || !precio) return showToast("⚠️ Llena nombre y precio");

    const btn = document.getElementById('saveBtn');
    btn.innerText = "PROCESANDO...";
    btn.disabled = true;

    let updateData = {
        nombre,
        precio: parseFloat(precio),
        descripcion,
        categoria
    };

    // Subir imagen si hay archivo
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

    let error;

    if (id) {
        const res = await _supabase.from('polos').update(updateData).eq('id', id);
        error = res.error;
    } else {
        const res = await _supabase.from('polos').insert([updateData]).select();
        error = res.error;
    }

    if (error) {
        showToast("❌ Error: " + error.message);
        btn.innerText = "GUARDAR CAMBIOS";
        btn.disabled = false;
        return;
    }

    showToast(id ? "✅ Polo actualizado" : "✅ Polo agregado");
    resetForm();
    loadProducts();
    loadInventory();

    btn.innerText = "GUARDAR CAMBIOS";
    btn.disabled = false;
}

async function deletePolo(id) {
    if (!confirm("¿Eliminar polo?")) return;
    const { error } = await _supabase.from('polos').delete().eq('id', id);
    if (error) {
        showToast("❌ Error al eliminar: " + error.message);
    } else {
        showToast("🗑️ Eliminado");
        loadInventory();
        loadProducts();
    }
}

function prepareEdit(polo) {
    document.getElementById('formTitle').innerText = "Editando Polo";
    document.getElementById('editPoloId').value = polo.id;
    document.getElementById('prodName').value = polo.nombre;
    document.getElementById('prodPrice').value = polo.precio;
    document.getElementById('prodDesc').value = polo.descripcion || '';
    if (document.getElementById('prodCategoria')) {
        document.getElementById('prodCategoria').value = polo.categoria || 'Básico';
    }
    document.getElementById('fileLabel').innerHTML = "📷 Seleccionar nueva imagen (opcional)";
    document.getElementById('cancelEdit').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('formTitle').innerText = "Agregar Polo";
    document.getElementById('editPoloId').value = "";
    document.getElementById('prodName').value = "";
    document.getElementById('prodPrice').value = "";
    document.getElementById('prodDesc').value = "";
    if (document.getElementById('prodCategoria')) {
        document.getElementById('prodCategoria').value = "Básico";
    }
    document.getElementById('imgFileInput').value = "";
    document.getElementById('fileLabel').innerHTML = "📷 Seleccionar Imagen";
    document.getElementById('cancelEdit').style.display = 'none';
}

// MODAL (versión simplificada sin stock por talla/color)
async function openModal(polo) {
    selectedPolo = polo;
    selectedColor = null;
    selectedTalla = null;

    document.getElementById('modalImg').src = polo.imagen_url || 'https://via.placeholder.com/300';
    document.getElementById('modalName').innerText = polo.nombre;
    document.getElementById('modalPrice').innerText = "S/ " + parseFloat(polo.precio).toFixed(2);
    document.getElementById('modalDesc').innerText = polo.descripcion || "Calidad Premium.";
    document.getElementById('modalCategoria').innerText = polo.categoria || "Básico";
    document.getElementById('colorSeleccionado').innerText = "—";
    document.getElementById('tallaSeleccionada').innerText = "—";
    document.getElementById('stockWarning').style.display = 'none';
    
    document.getElementById('modalOverlay').classList.add('open');
}

function addToCartFromModal() {
    if (!selectedPolo) return;
    
    showToast("✅ Añadido al carrito");
    closeModal();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
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
    container.innerHTML = '';
    
    cart.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        container.innerHTML += `
            <div class="cart-item">
                <span>${item.nombre}</span>
                <span>S/ ${item.precio.toFixed(2)} x ${item.cantidad}</span>
                <span>S/ ${subtotal.toFixed(2)}</span>
                <button onclick="removeFromCart(${index})">❌</button>
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
    
    let mensaje = "🛍️ *NUEVO PEDIDO*%0A";
    let total = 0;
    
    cart.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        mensaje += `%0A• ${item.nombre} x${item.cantidad} = S/ ${subtotal.toFixed(2)}`;
    });
    
    mensaje += `%0A%0A💰 *TOTAL: S/ ${total.toFixed(2)}*`;
    mensaje += "%0A%0A📦 *POLO STUDIO*";
    
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
            showToast("Modo Admin Activado");
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
