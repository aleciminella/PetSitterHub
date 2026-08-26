function getSavedUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    if (!savedUser) {
        return null;
    }
    return JSON.parse(savedUser);
}

function logout() {
    localStorage.removeItem("petsitterhubUser");
    window.location.href = "/index.html";
}

function updateNavbar() {
    const user = getSavedUser();
    const inPages = window.location.pathname.includes("/pages/");
    const prefix = inPages ? "../" : "";
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const onHome = currentPage === "index.html";
    const onServices = currentPage === "services.html";
    const onOwnerDashboard = currentPage === "owner-dashboard.html";

    if (!$("#navbarActions").length) {
        return;
    }

    $("#mainNavbarLinks").html(`
        ${onHome ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}index.html#search">Cerca sitter</a></li>`}
        ${onServices ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}pages/services.html">Servizi</a></li>`}
        ${user && user.role === "owner" && !onOwnerDashboard ? `<li class="nav-item"><a class="nav-link" href="${prefix}pages/owner-dashboard.html">Dashboard</a></li>` : ""}
    `);

    if (!user) {
        $("#navbarActions").html(`
            <a class="btn btn-outline-primary" href="${prefix}pages/login.html">Login</a>
            <a class="btn btn-primary" href="${prefix}pages/register.html">Registrati</a>
        `);
        return;
    }

    $("#navbarActions").html(`
        <button type="button" class="btn btn-outline-secondary" id="logoutButton">Logout</button>
    `);

    $("#logoutButton").on("click", logout);
}

$(document).ready(function () {
    updateNavbar();
});