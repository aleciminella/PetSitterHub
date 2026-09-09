//  file custode dell'identità dell'utente nel browser. Caricato da ogni singola pagina, gestisce i pulsanti della navbar e il relativo pallino delle notifiche

// localStorage è una specie di "taccuino segreto" che il browser tiene sull'hard disk

function getSavedUser() { // Va nel taccuino e cerca "petsitterhubUser" (auth.js).
    const savedUser = localStorage.getItem("petsitterhubUser");
    return savedUser ? JSON.parse(savedUser) : null; // Siccome sul taccuino i dati sono salvati come testo, usa JSON.parse per ritrasformarli in un vero oggetto JavaScript (con nome, cognome, ruolo). Se non c'è restituisce null
}

function getSavedToken() { // Recupera il token assegnato dal backend al login
    return localStorage.getItem("petsitterhubToken");
}

function logout() { // elimina dal taccuino e reindirizza nella home page
    localStorage.removeItem("petsitterhubUser");
    localStorage.removeItem("petsitterhubToken");
    window.location.href = "/index.html";
}

function renderNavUnreadDot(hasUnreadItems) { // crea pallino rosso
    return hasUnreadItems ? '<span class="nav-unread-dot" aria-hidden="true"></span>' : "";
}

function loadNavbarBadge(user) {
    const token = getSavedToken();
    if (!user || !token || user.role === "admin") return;

    $.when( // vengono fatte 2 richieste
        $.ajax({ url: "http://localhost:4000/api/notifications", method: "GET", headers: { Authorization: `Bearer ${token}` } }), // se ci sono notifiche
        $.ajax({ url: "http://localhost:4000/api/messages/unread-count", method: "GET", headers: { Authorization: `Bearer ${token}` } }) // se ci sono messaggi
    ).done(function (notificationsResponse, messagesResponse) {
        const hasUnreadNotifications = Number(notificationsResponse[0].unreadCount || 0) > 0; // se notifiche > 0 = true
        const hasUnreadMessages = Number(messagesResponse[0].unreadCount || 0) > 0; // se messaggi > 0 = true
        const dashboardLink = $(".dashboard-link"); // Cerca nella pagina HTML il link con classe .dashboard-link (cioè il pulsante "Dashboard" nella barra di navigazione).

        dashboardLink.append(renderNavUnreadDot(hasUnreadNotifications || hasUnreadMessages)); // se uno dei due vero chiama la funzione precedente

        if (hasUnreadNotifications || hasUnreadMessages) { // Servono per l'accessibilità (per le persone non vedenti che usano sintetizzatori vocali)
            dashboardLink.attr("aria-label", `${dashboardLink.text().trim()}. Hai elementi non letti`);
        }
    });
}

function validateSavedSession(user) { // Ogni volta che apri una pagina, questo script fa una chiamata silenziosa al backend su /api/auth/profile per verificare se il token è ancora valido.
    const token = getSavedToken();

    if (!user || !token) return;

    $.ajax({
        url: "http://localhost:4000/api/auth/profile",
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    }).fail(function (xhr) {
        if (xhr.status === 401 || xhr.status === 404) { // Se il token è scaduto (errore 401) o se l'utente è stato cancellato dal database (errore 404), chiama all'istante la funzione logout()!
            logout();
        }
    });
}



function updateNavbar() {
    let user = getSavedUser();
    const token = getSavedToken();

    if (user && !token) { // Se per qualche motivo ci sono i dati dell'utente ma manca il token, sei in uno stato "rotto". Quindi resetta tutto a null: per il sito torni a essere un visitatore non loggato.
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

    if (!$("#navbarActions").length) return; // controlla che c'è id navbarActions


    // aggiunge pulsanti in base a dove si trova all'interno dell'app e a quale utente
    $("#mainNavbarLinks").html(`
        ${onHome ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}index.html#search">Cerca sitter</a></li>`}
        ${onServices ? "" : `<li class="nav-item"><a class="nav-link" href="${prefix}pages/services.html">Servizi</a></li>`}
        ${user && user.role === "owner" && !onOwnerDashboard ? `<li class="nav-item"><a class="nav-link dashboard-link position-relative" href="${prefix}pages/owner-dashboard.html">Dashboard</a></li>` : ""}
        ${user && user.role === "sitter" && !onSitterDashboard ? `<li class="nav-item"><a class="nav-link dashboard-link position-relative" href="${prefix}pages/sitter-dashboard.html">Area sitter</a></li>` : ""}
        ${user && user.role === "admin" && !onAdminDashboard ? `<li class="nav-item"><a class="nav-link" href="${prefix}pages/admin-dashboard.html">Area admin</a></li>` : ""}
    `);

    if (!user) { // se non registrato cancella tutto ciò che c'era e disegna i due pulsanti: Login (bianco con bordo blu) e Registrati (tutto blu)
        $("#navbarActions").html(`
            <a class="btn btn-outline-primary" href="${prefix}pages/login.html">Login</a>
            <a class="btn btn-primary" href="${prefix}pages/register.html">Registrati</a>
        `);
        return;
    }

    $("#navbarActions").html(`<button type="button" class="btn btn-outline-secondary" id="logoutButton">Logout</button>`);
    $("#logoutButton").on("click", logout);
    validateSavedSession(user);
    loadNavbarBadge(user);
}

$(document).ready(updateNavbar);
