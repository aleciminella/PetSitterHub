function getSavedUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    if (!savedUser) {
        return null;
    }
    return JSON.parse(savedUser);
}

function logout() {
    localStorage.removeItem("petsitterhubUser");
    window.location.reload();
}

function updateNavbar() {
    const user = getSavedUser();
    if (!$("#navbarActions").length) {
        return;
    }

    if (!user) {
        $("#navbarActions").html(`
            <a class="btn btn-outline-primary" href="pages/login.html">Login</a>
            <a class="btn btn-primary" href="pages/register.html">Registrati</a>
        `);
        return;
    }

    $("#navbarActions").html(`
        <span class="navbar-text">Ciao, ${user.first_name}</span>
        <button type="button" class="btn btn-outline-secondary" id="logoutButton">Logout</button>
    `);

    $("#logoutButton").on("click", logout);
}

$(document).ready(function () {
    updateNavbar();
});