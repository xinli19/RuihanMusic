// 睿涵音乐后台管理系统 - 基础JavaScript

// 全局工具函数
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// 显示成功消息
function showSuccess(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success';
    alertDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
        <button type="button" class="close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 3000);
}

// 显示错误消息
function showError(message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-error';
    alertDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
        <button type="button" class="close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const container = document.querySelector('.main-content') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (alertDiv.parentElement) {
            alertDiv.remove();
        }
    }, 5000);
}

// 侧边栏功能
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
        sidebar.classList.remove('collapsed');
        localStorage.setItem('sidebarCollapsed', 'false');
    } else {
        sidebar.classList.add('collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
    }
}

// 移动端侧边栏控制
function openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.add('mobile-open');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('mobile-open');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// 设置当前激活的导航项
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (href && currentPath.startsWith(href) && href !== '/') {
            link.classList.add('active');
        }
    });
}

// 添加工具提示
function addTooltips() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    const navLinks = sidebar.querySelectorAll('.nav-link');
    const footerLinks = sidebar.querySelectorAll('.footer-link');
    
    [...navLinks, ...footerLinks].forEach(link => {
        const textElement = link.querySelector('.nav-text, .footer-text');
        if (textElement) {
            link.setAttribute('title', textElement.textContent.trim());
        }
    });
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    // 恢复侧边栏状态
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebar && sidebarCollapsed === 'true') {
        sidebar.classList.add('collapsed');
    }
    
    // 设置当前激活的导航项
    setActiveNavItem();
    
    // 添加工具提示
    addTooltips();
    
    // 创建移动端遮罩
    if (window.innerWidth <= 768) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeMobileSidebar;
        document.body.appendChild(overlay);
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileSidebar();
        }
    });
    
    // 退出登录确认
    const logoutLink = document.querySelector('.logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            if (!confirm('确定要退出登录吗？')) {
                e.preventDefault();
            }
        });
    }
});