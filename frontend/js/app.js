function getSavedUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    return savedUser ? JSON.parse(savedUser) : null;
}

function getSavedToken() {
    return localStorage.getItem("petsitterhubToken");
}

function logout() {
    localStorage.removeItem("petsitterhubUser");
    localStorage.removeItem("petsitterhubToken");
    window.location.href = "/index.html";
}

function renderNavBadge(count) {
    return count > 0 ? `<span class="nav-badge">${count}</span>` : "";
}

function loadNavbarBadge(user) {
    const token = getSavedToken();
    if (!user || !token || user.role === "admin") return;

    $.when(
        $.ajax({ url: "http://localhost:4000/api/notifications", method: "GET", headers: { Authorization: `Bearer ${token}` } }),
        $.ajax({ url: "http://localhost:4000/api/messages/unread-count", method: "GET", headers: { Authorization: `Bearer ${token}` } })
    ).done(function (notificationsResponse, messagesResponse) {
        const total = (notificationsResponse[0].unreadCount || 0) + (messagesResponse[0].unreadCount || 0);
        $(".dashboard-link").append(renderNavBadge(total));
    });
}

function updateNavbar() {
    let user = getSavedUser();
    const token = getSavedToken();

    if (user && !token) {
        localStorage.removeItem("petsitterhubUser");
        user = null;
    }

    const inPages = window.location.pathname.includes("/pages/");
    const prefix = inPages ? "../" : "";
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const onHome = currentPage === "index.html";
    const onServices = currentPage === "services.html";
    const onOwnerDashboard = currentPage === "owner-dashboard.html";
    const onSitterDashboard = currentPage === "sitter-dashboard.html";
    const onAdminDashboard = currentPage === "admin-dashboard.html";

    if (!$("#navbarActions").length) return;

    $("#mainNavbarLinks").html(`
        ${onHome ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}index.html#search">Cerca sitter</a></li>`}
        ${onServices ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}pages/services.html">Servizi</a></li>`}
        ${user && user.role === "owner" && !onOwnerDashboard ? `<li class="nav-item"><a class="nav-link dashboard-link position-relative" href="${prefix}pages/owner-dashboard.html">Dashboard</a></li>` : ""}
        ${user && user.role === "sitter" && !onSitterDashboard ? `<li class="nav-item"><a class="nav-link dashboard-link position-relative" href="${prefix}pages/sitter-dashboard.html">Area sitter</a></li>` : ""}
        ${user && user.role === "admin" && !onAdminDashboard ? `<li class="nav-item"><a class="nav-link" href="${prefix}pages/admin-dashboard.html">Area admin</a></li>` : ""}
    `);

    if (!user) {
        $("#navbarActions").html(`
            <a class="btn btn-outline-primary" href="${prefix}pages/login.html">Login</a>
            <a class="btn btn-primary" href="${prefix}pages/register.html">Registrati</a>
        `);
        return;
    }

    $("#navbarActions").html(`<button type="button" class="btn btn-outline-secondary" id="logoutButton">Logout</button>`);
    $("#logoutButton").on("click", logout);
    loadNavbarBadge(user);
}

$(document).ready(updateNavbar);