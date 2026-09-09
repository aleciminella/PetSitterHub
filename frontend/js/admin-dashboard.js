const API_BASE_URL = "http://localhost:4000/api";
const ADMIN_LIMIT = 5;

let usersOffset = 0;
let bookingsOffset = 0;
let reviewsOffset = 0;
let usersHasMore = false;
let bookingsHasMore = false;
let reviewsHasMore = false;

function getAdminToken() {
    return localStorage.getItem("petsitterhubToken");
}

function getAdminUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    return savedUser ? JSON.parse(savedUser) : null;
}

function adminHeaders() {
    return {
        Authorization: `Bearer ${getAdminToken()}`
    };
}

function guardAdminDashboard() {
    const user = getAdminUser();
    const token = getAdminToken();
    if (!user || !token || user.role !== "admin") {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function formatAdminDate(value) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString("it-IT");
}

function formatAdminMoney(value) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function bookingStatusText(status) {
    const labels = {
        pending: "In attesa",
        accepted: "Accettata",
        rejected: "Rifiutata",
        cancelled: "Annullata",
        completed: "Completata"
    };
    return labels[status] || status || "-";
}

function renderAdminStats(overview) {
    const cards = [
        { label: "Utenti", value: overview.total_users },
        { label: "Proprietari", value: overview.total_owners },
        { label: "Sitter", value: overview.total_sitters },
        { label: "Admin", value: overview.total_admins },
        { label: "Prenotazioni", value: overview.total_bookings },
        { label: "Richieste in attesa", value: overview.pending_bookings },
        { label: "Prenotazioni accettate", value: overview.accepted_bookings },
        { label: "Recensioni", value: overview.total_reviews }
    ];
    $("#adminStats").html(cards.map(function (card) {
        return `
            <div class="col-sm-6 col-lg-3">
                <div class="admin-stat">
                    <span>${card.label}</span>
                    <strong>${card.value || 0}</strong>
                </div>
            </div>
        `;
    }).join(""));
}

function loadAdminOverview() {
    $.ajax({
        url: `${API_BASE_URL}/admin/overview`,
        method: "GET",
        headers: adminHeaders(),
        success: function (response) {
            renderAdminStats(response.overview || {});
        },
        error: function () {
            $("#adminStats").html('<div class="col-12 text-danger">Errore durante il caricamento della panoramica.</div>');
        }
    });
}

function renderAdminUsers(users, append) {
    if (!append) {
        $("#adminUsersTable").html("");
    }
    if (!users.length && !append) {
        $("#adminUsersTable").html('<tr><td colspan="5" class="text-muted">Nessun utente trovato.</td></tr>');
        $("#loadMoreAdminUsers").addClass("d-none");
        return;
    }
    const currentUser = getAdminUser();
    const html = users.map(function (user) {
        const sitterStatus = user.sitter_profile_id
            ? `<span class="badge ${user.sitter_verified ? "text-bg-success" : "text-bg-warning"}">${user.sitter_verified ? "Verificato" : "Da verificare"}</span>`
            : "-";
        const verificationButton = user.sitter_profile_id
            ? `<button type="button" class="btn btn-sm btn-outline-primary verify-sitter-button" data-sitter-id="${user.sitter_profile_id}" data-verified="${!user.sitter_verified}">
                    ${user.sitter_verified ? "Rimuovi verifica" : "Verifica sitter"}
               </button>`
            : "";
        const promoteButton = user.role !== "admin"
            ? `<button type="button" class="btn btn-sm btn-outline-success promote-admin-button" data-user-id="${user.id}">
                    Rendi admin
               </button>`
            : "";
        const deleteButton = Number(user.id) !== Number(currentUser.id)
            ? `<button type="button" class="btn btn-sm btn-outline-danger delete-user-button" data-user-id="${user.id}" data-user-name="${user.first_name} ${user.last_name}">
                    Elimina
               </button>`
            : "";
        return `
            <tr>
                <td>
                    <strong>${user.first_name} ${user.last_name}</strong><br>
                    <span class="text-muted">${user.email}</span>
                </td>
                <td>${user.role}</td>
                <td>${user.city || "-"}</td>
                <td>${sitterStatus}</td>
                <td class="text-end">
                    <div class="d-flex justify-content-end gap-2 flex-wrap">
                        ${verificationButton}
                        ${promoteButton}
                        ${deleteButton}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
    $("#adminUsersTable").append(html);
    $("#loadMoreAdminUsers").toggleClass("d-none", !usersHasMore);
}

function loadAdminUsers(append = false) {
    if (!append) {
        usersOffset = 0;
        $("#adminUsersTable").html('<tr><td colspan="5" class="text-muted">Caricamento utenti...</td></tr>');
    }
    const search = encodeURIComponent($("#userSearch").val().trim());
    const sort = $("#userSort").val();
    $.ajax({
        url: `${API_BASE_URL}/admin/users?limit=${ADMIN_LIMIT}&offset=${usersOffset}&sort=${sort}&search=${search}`,
        method: "GET",
        headers: adminHeaders(),
        success: function (response) {
            const users = response.users || [];
            usersHasMore = users.length === ADMIN_LIMIT;
            usersOffset += users.length;
            renderAdminUsers(users, append);
        },
        error: function () {
            $("#adminUsersTable").html('<tr><td colspan="5" class="text-danger">Errore durante il caricamento degli utenti.</td></tr>');
        }
    });
}

function renderAdminBookings(bookings, append) {
    if (!append) {
        $("#adminBookingsList").html("");
    }
    if (!bookings.length && !append) {
        $("#adminBookingsList").html('<p class="text-muted mb-0">Nessuna prenotazione.</p>');
        $("#loadMoreAdminBookings").addClass("d-none");
        return;
    }
    const html = bookings.map(function (booking) {
        return `
            <div class="admin-list-item">
                <div class="d-flex justify-content-between gap-3">
                    <strong>${booking.service_name}</strong>
                    <span class="badge text-bg-secondary">${bookingStatusText(booking.status)}</span>
                </div>
                <p class="mb-1">
                    ${booking.owner_first_name} ${booking.owner_last_name}
                    con ${booking.sitter_first_name} ${booking.sitter_last_name}
                </p>
                <p class="mb-1">Animale: ${booking.pet_name} (${booking.pet_type})</p>
                <p class="text-muted mb-1">Dal ${formatAdminDate(booking.starts_at)} al ${formatAdminDate(booking.ends_at)}</p>
                <p class="mb-0">Totale: ${formatAdminMoney(booking.total_price)}</p>
            </div>
        `;
    }).join("");
    $("#adminBookingsList").append(html);
    $("#loadMoreAdminBookings").toggleClass("d-none", !bookingsHasMore);
}

function loadAdminBookings(append = false) { // quando viene schiacciato pulsante mostra altri append passato è true e l'offset non viene inizializzato l'offset
    if (!append) {
        bookingsOffset = 0;
        $("#adminBookingsList").html('<p class="text-muted mb-0">Caricamento prenotazioni...</p>');
    }
    $.ajax({
        url: `${API_BASE_URL}/admin/bookings?limit=${ADMIN_LIMIT}&offset=${bookingsOffset}`,
        method: "GET",
        headers: adminHeaders(),
        success: function (response) {
            const bookings = response.bookings || [];
            bookingsHasMore = bookings.length === ADMIN_LIMIT;
            bookingsOffset += bookings.length;
            renderAdminBookings(bookings, append);
        },
        error: function () {
            $("#adminBookingsList").html('<p class="text-danger mb-0">Errore durante il caricamento delle prenotazioni.</p>');
        }
    });
}

function renderAdminReviews(reviews, append) {
    if (!append) {
        $("#adminReviewsList").html("");
    }
    if (!reviews.length && !append) {
        $("#adminReviewsList").html('<p class="text-muted mb-0">Nessuna recensione.</p>');
        $("#loadMoreAdminReviews").addClass("d-none");
        return;
    }
    const html = reviews.map(function (review) {
        return `
            <div class="admin-list-item">
                <div class="d-flex justify-content-between gap-3">
                    <strong>${review.rating}/5</strong>
                    <span class="text-muted">${formatAdminDate(review.created_at)}</span>
                </div>
                <p class="mb-1">
                    ${review.owner_first_name} ${review.owner_last_name}
                    su ${review.sitter_first_name} ${review.sitter_last_name}
                </p>
                <p class="mb-1">Servizio: ${review.service_name}</p>
                <p class="mb-0">${review.comment || "Nessun commento."}</p>
            </div>
        `;
    }).join("");
    $("#adminReviewsList").append(html);
    $("#loadMoreAdminReviews").toggleClass("d-none", !reviewsHasMore);
}

function loadAdminReviews(append = false) {
    if (!append) {
        reviewsOffset = 0;
        $("#adminReviewsList").html('<p class="text-muted mb-0">Caricamento recensioni...</p>');
    }
    $.ajax({
        url: `${API_BASE_URL}/admin/reviews?limit=${ADMIN_LIMIT}&offset=${reviewsOffset}`,
        method: "GET",
        headers: adminHeaders(),
        success: function (response) {
            const reviews = response.reviews || [];
            reviewsHasMore = reviews.length === ADMIN_LIMIT;
            reviewsOffset += reviews.length;
            renderAdminReviews(reviews, append);
        },
        error: function () {
            $("#adminReviewsList").html('<p class="text-danger mb-0">Errore durante il caricamento delle recensioni.</p>');
        }
    });
}

function refreshAdminData() {
    loadAdminOverview();
    loadAdminUsers();
    loadAdminBookings();
    loadAdminReviews();
}

function promoteUserToAdmin(userId) {
    if (!confirm("Rendere questo utente admin?")) {
        return;
    }
    $.ajax({
        url: `${API_BASE_URL}/admin/users/${userId}/promote-admin`,
        method: "PATCH",
        headers: adminHeaders(),
        success: refreshAdminData,
        error: function (xhr) {
            alert(xhr.responseJSON?.error || "Errore durante la promozione dell'utente.");
        }
    });
}

function updateSitterVerification(sitterId, verified) {
    $.ajax({
        url: `${API_BASE_URL}/admin/sitters/${sitterId}/verification`,
        method: "PATCH",
        headers: adminHeaders(),
        contentType: "application/json",
        data: JSON.stringify({ verified }),
        success: refreshAdminData,
        error: function () {
            alert("Errore durante l'aggiornamento della verifica sitter.");
        }
    });
}

function deleteUser(userId, userName) {
    if (!confirm(`Eliminare ${userName}? Le prenotazioni attive verranno annullate, gli eventuali pagamenti rimborsati e lo storico verrà conservato.`)) {
        return;
    }
    $.ajax({
        url: `${API_BASE_URL}/admin/users/${userId}`,
        method: "DELETE",
        headers: adminHeaders(),
        success: refreshAdminData,
        error: function (xhr) {
            alert(xhr.responseJSON?.error || "Errore durante l'eliminazione dell'utente.");
        }
    });
}

$(document).ready(function () {
    if (!guardAdminDashboard()) {
        return;
    }
    refreshAdminData();
    $("#refreshAdminData").on("click", refreshAdminData);
    $("#userSearch").on("input", function () {
        loadAdminUsers();
    });
    $("#userSort").on("change", function () {
        loadAdminUsers();
    });
    $("#loadMoreAdminUsers").on("click", function () {
        loadAdminUsers(true);
    });
    $("#loadMoreAdminBookings").on("click", function () {
        loadAdminBookings(true);
    });
    $("#loadMoreAdminReviews").on("click", function () {
        loadAdminReviews(true);
    });
    $("#adminUsersTable").on("click", ".promote-admin-button", function () {
        promoteUserToAdmin($(this).data("user-id"));
    });
    $("#adminUsersTable").on("click", ".verify-sitter-button", function () {
        updateSitterVerification($(this).data("sitter-id"), $(this).data("verified"));
    });
    $("#adminUsersTable").on("click", ".delete-user-button", function () {
        deleteUser($(this).data("user-id"), $(this).data("user-name"));
    });
});
