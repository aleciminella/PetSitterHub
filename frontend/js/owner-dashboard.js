const API_BASE_URL = "http://localhost:4000/api";
let petsCache = [];
let bookingsOffset = 0;
let bookingsHasMore = false;
const BOOKINGS_LIMIT = 5;
let notificationsOffset = 0; 
let notificationsHasMore = false; 
const NOTIFICATIONS_LIMIT = 3; 

function getSavedUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    if (!savedUser) {
        return null;
    }
    return JSON.parse(savedUser);
}

function getSavedToken() {
    return localStorage.getItem("petsitterhubToken");
}

function authHeaders() {
    return {
        Authorization: `Bearer ${getSavedToken()}`
    };
}

function showPetsMessage(type, text) {
    $("#petsMessage")
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function clearPetsMessage() {
    $("#petsMessage")
        .addClass("d-none")
        .removeClass("alert-success alert-danger")
        .text("");
}

function renderPets(pets) {
    if (!pets.length) {
        $("#petsList").html('<div class="empty-state">Non hai ancora inserito animali.</div>');
        return;
    }

    $("#petsList").html(pets.map(function (pet) {
        return `
            <article class="pet-item">
                <div>
                    <h3 class="h5 mb-1">${pet.name}</h3>
                    <p class="text-muted mb-1">${pet.species}${pet.breed ? ` - ${pet.breed}` : ""}</p>
                    <p class="mb-0">${pet.notes || "Nessuna nota."}</p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-outline-primary btn-sm edit-pet-button" type="button" data-id="${pet.id}">Modifica</button>
                    <button class="btn btn-outline-danger btn-sm delete-pet-button" type="button" data-id="${pet.id}">Elimina</button>
                </div>
            </article>
        `;
    }).join(""));
}

function loadPets() {
    $("#petsList").html('<div class="empty-state">Caricamento animali...</div>');

    $.ajax({
        url: `${API_BASE_URL}/pets`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            petsCache = response.pets || [];
            renderPets(petsCache);
        },
        error: function () {
            $("#petsList").html('<div class="empty-state text-danger">Errore durante il caricamento degli animali.</div>');
        }
    });
}

function guardOwnerDashboard() {
    const user = getSavedUser();
    const token = getSavedToken();
    if (!user || !token || user.role !== "owner") {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function resetPetForm() {
    $("#petId").val("");
    $("#petForm")[0].reset();
    $("#savePetButton").text("Salva animale");
    $("#cancelEditPetButton").addClass("d-none");
}

function getPetFormData() {
    return {
        name: $("#petName").val(),
        species: $("#petSpecies").val(),
        breed: $("#petBreed").val(),
        notes: $("#petNotes").val()
    };
}

function startPetEdit(petId) {
    const pet = petsCache.find(function (item) {
        return String(item.id) === String(petId);
    });
    if (!pet) {
        return;
    }

    $("#petId").val(pet.id);
    $("#petName").val(pet.name);
    $("#petSpecies").val(pet.species);
    $("#petBreed").val(pet.breed || "");
    $("#petNotes").val(pet.notes || "");
    $("#savePetButton").text("Aggiorna animale");
    $("#cancelEditPetButton").removeClass("d-none");
}

function deletePet(petId) {
    clearPetsMessage();
    $.ajax({
        url: `${API_BASE_URL}/pets/${petId}`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            showPetsMessage("success", "Animale eliminato correttamente.");
            loadPets();
        },
        error: function () {
            showPetsMessage("danger", "Errore durante l'eliminazione dell'animale.");
        }
    });
}

function savePet(event) {
    event.preventDefault();
    clearPetsMessage();

    const petId = $("#petId").val();
    const method = petId ? "PUT" : "POST";
    const url = petId ? `${API_BASE_URL}/pets/${petId}` : `${API_BASE_URL}/pets`;

    $.ajax({
        url,
        method,
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify(getPetFormData()),
        success: function () {
            showPetsMessage("success", petId ? "Animale aggiornato correttamente." : "Animale salvato correttamente.");
            resetPetForm();
            loadPets();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio dell'animale.";
            showPetsMessage("danger", message);
        }
    });
}
function formatDateTime(value) {
    return new Date(value).toLocaleString("it-IT");
}

function getBookingStatusLabel(status, paymentStatus) {
    if (status === "pending") {
        return "In attesa di conferma";
    }
    if (status === "accepted" && !paymentStatus) {
        return "In attesa di pagamento";
    }
    if (status === "rejected") {
        return "Richiesta rifiutata";
    }
    if (status === "cancelled") {
        return "Annullata";
    }
    if (status === "completed") {
        return "Completata";
    }
    if (paymentStatus === "paid") {
        return "Pagamento effettuato";
    }
    if (paymentStatus === "authorized") {
        return "Bonifico in verifica";
    }
    if (paymentStatus === "refunded") {
        return "Rimborso avviato";
    }
    return status;
}

function canPayBooking(booking) {
    return booking.status === "accepted" && !booking.payment_status;
}

function renderPaymentForm(booking) {
    if (!canPayBooking(booking)) {
        return "";
    }
    return `
        <form class="payment-form row g-2 mt-3" data-id="${booking.id}">
            <div class="col-md-8">
                <select class="form-select payment-method" required>
                    <option value="demo_card">Carta demo</option>
                    <option value="bank_transfer">Bonifico</option>
                </select>
            </div>
            <div class="col-md-4">
                <button class="btn btn-primary w-100" type="submit">Paga</button>
            </div>
        </form>
    `;
}

function renderUnreadMessagesBadge(booking) {
    const unreadMessages = Number(booking.unread_messages || 0);
    if (unreadMessages === 0) {
        return "";
    }
    return `<span class="message-count-badge">${unreadMessages}</span>`;
}

function renderBookings(bookings, append) {
    if (!append) {
        $("#bookingsList").html("");
    }
    if (!bookings.length && !append) {
        $("#bookingsList").html('<div class="empty-state">Nessuna prenotazione trovata.</div>');
        $("#loadMoreBookingsButton").addClass("d-none");
        return;
    }

    const html = bookings.map(function (booking) {
        return `
            <article class="booking-card" data-id="${booking.id}">
                <div class="booking-card-header">
                    <div>
                        <h3 class="h5 mb-2">${booking.service_name}</h3>
                        <p class="mb-1">Con: ${booking.sitter_first_name} ${booking.sitter_last_name}</p>
                        <p class="mb-1">Animale: ${booking.pet_name} (${booking.pet_type})</p>
                        <p class="mb-1">Dal ${formatDateTime(booking.starts_at)} al ${formatDateTime(booking.ends_at)}</p>
                        <p class="mb-1">Totale: ${Number(booking.total_price).toFixed(2)} €</p>
                        <p class="mb-0">${booking.notes || "Nessuna nota."}</p>
                    </div>
                    <span class="booking-status booking-status-${booking.status}">
                    ${getBookingStatusLabel(booking.status, booking.payment_status)}
                    </span>
                </div>
                ${["pending", "accepted"].includes(booking.status) ? `
                    <div class="mt-3">
                        <button class="btn btn-outline-danger btn-sm cancel-booking-button" type="button" data-id="${booking.id}">
                            Annulla
                        </button>
                    </div>
                ` : ""}
                ${renderPaymentForm(booking)}
                <div class="mt-3">
                <button class="btn btn-outline-secondary btn-sm toggle-messages-button position-relative" type="button" data-id="${booking.id}"> 
                     Messaggi ${renderUnreadMessagesBadge(booking)}
                </button>
            </div>
            <div class="booking-message-box d-none" id="messages-${booking.id}">
                <div class="booking-messages-list mb-3"></div>
                <div class="d-flex gap-2">
                    <input class="form-control message-input" type="text" placeholder="Scrivi un messaggio">
                    <button class="btn btn-primary send-message-button" type="button" data-id="${booking.id}">
                        Invia
                    </button>
                </div>
            </div>
            </article>
        `;
    }).join("");

    $("#bookingsList").append(html);
    $("#loadMoreBookingsButton").toggleClass("d-none", !bookingsHasMore);
}

function loadBookings(append = false) {
    if (!append) {
        bookingsOffset = 0;
        $("#bookingsList").html('<div class="empty-state">Caricamento prenotazioni...</div>');
    }

    const period = $("#bookingPeriod").val() || "future";

    $.ajax({
        url: `${API_BASE_URL}/bookings?period=${period}&limit=${BOOKINGS_LIMIT}&offset=${bookingsOffset}`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const bookings = response.bookings || [];
            bookingsHasMore = bookings.length === BOOKINGS_LIMIT;
            bookingsOffset += bookings.length;
            renderBookings(bookings, append);
        },
        error: function () {
            $("#bookingsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle prenotazioni.</div>');
            $("#loadMoreBookingsButton").addClass("d-none");
        }
    });
}
function cancelBooking(bookingId) {
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/cancel`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadBookings();
        },
        error: function () {
            $("#bookingsMessage")
                .removeClass("d-none alert-success")
                .addClass("alert-danger")
                .text("Errore durante l'annullamento della prenotazione.");
        }
    });
}

function payBooking(bookingId, method) {
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/payments`,
        method: "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({ method }),
        success: function () {
            loadBookings();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il pagamento.";
            $("#bookingsMessage")
                .removeClass("d-none alert-success")
                .addClass("alert-danger")
                .text(message);
        }
    });
}

function renderMessages(container, messages) {
    if (!messages.length) {
        container.html('<div class="text-muted">Nessun messaggio.</div>');
        return;
    }
    container.html(messages.map(function (message) {
        return `
            <div class="booking-message-item">
                <strong>${message.sender_first_name} ${message.sender_last_name}</strong>
                <p class="mb-0">${message.body}</p>
            </div>
        `;
    }).join(""));
}

function loadMessages(bookingId) {
    const box = $(`#messages-${bookingId}`);
    const list = box.find(".booking-messages-list");
    list.html('<div class="text-muted">Caricamento messaggi...</div>');
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/messages`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderMessages(list, response.messages || []);
        },
        error: function () {
            list.html('<div class="text-danger">Errore durante il caricamento dei messaggi.</div>');
        }
    });
}

function sendMessage(bookingId, input) {
    const body = input.val().trim();
    if (!body) {
        return;
    }
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/messages`,
        method: "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({ body }),
        success: function () {
            input.val("");
            loadMessages(bookingId);
        },
        error: function () {
            $("#bookingsMessage")
                .removeClass("d-none alert-success")
                .addClass("alert-danger")
                .text("Errore durante l'invio del messaggio.");
        }
    });
}

function renderNotifications(notifications, append) {
    if (!append) {
        $("#ownerNotificationsList").html("");
    }
    if (!notifications.length && !append) {
        $("#ownerNotificationsList").html('<div class="empty-state">Nessuna notifica.</div>');
        $("#loadMoreNotificationsButton").addClass("d-none");
        return;
    }
    const html = notifications.map(function (notification) {
        return `
            <article class="booking-message-item ${notification.is_read ? "" : "border border-primary"}">
                <div class="d-flex justify-content-between gap-3">
                    <div>
                        <strong>${notification.title}</strong>
                        <p class="mb-1">${notification.body}</p>
                        <small class="text-muted">${formatDateTime(notification.created_at)}</small>
                    </div>
                    <div class="d-flex gap-2 align-items-start">
                        ${notification.is_read ? "" : `<button class="btn btn-outline-primary btn-sm read-notification-button" type="button" data-id="${notification.id}">Letta</button>`}
                        <button class="btn btn-outline-danger btn-sm delete-notification-button" type="button" data-id="${notification.id}">Elimina</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
    $("#ownerNotificationsList").append(html);
    $("#loadMoreNotificationsButton").toggleClass("d-none", !notificationsHasMore);
}

function loadNotifications(append = false) {
    if (!append) {
        notificationsOffset = 0;
    }
    $.ajax({
        url: `${API_BASE_URL}/notifications?limit=${NOTIFICATIONS_LIMIT}&offset=${notificationsOffset}`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const notifications = response.notifications || [];
            notificationsHasMore = notifications.length === NOTIFICATIONS_LIMIT;
            notificationsOffset += notifications.length;
            $("#ownerNotificationsBadge")
                .toggleClass("d-none", !response.unreadCount)
                .text(response.unreadCount || "");
            renderNotifications(notifications, append);
        },
        error: function () {
            $("#ownerNotificationsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle notifiche.</div>');
        }
    });
}

function markNotificationAsRead(notificationId) {
    $.ajax({
        url: `${API_BASE_URL}/notifications/${notificationId}/read`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

function markAllNotificationsAsRead() {
    $.ajax({
        url: `${API_BASE_URL}/notifications/read-all`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

function deleteNotification(notificationId) {
    $.ajax({
        url: `${API_BASE_URL}/notifications/${notificationId}`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

$(document).ready(function () {
    if (!guardOwnerDashboard()) {
        return;
    }

    loadPets();
    loadBookings();
    loadNotifications(); 
    $("#refreshPetsButton").on("click", loadPets);
    $("#bookingPeriod").on("change", function () {
        loadBookings();
    });
    
    $("#loadMoreBookingsButton").on("click", function () {
        loadBookings(true);
    });
    $("#petForm").on("submit", savePet);

    $("#petsList").on("click", ".edit-pet-button", function () {
        startPetEdit($(this).data("id"));
    });

    $("#petsList").on("click", ".delete-pet-button", function () {
        deletePet($(this).data("id"));
    });

    $("#cancelEditPetButton").on("click", resetPetForm);
    $("#bookingsList").on("click", ".cancel-booking-button", function () {
        cancelBooking($(this).data("id"));
    });

    $("#bookingsList").on("click", ".toggle-messages-button", function () {
        const bookingId = $(this).data("id");
        const box = $(`#messages-${bookingId}`);
        box.toggleClass("d-none");
        if (!box.hasClass("d-none")) {
            loadMessages(bookingId);
        }
    });
    
    $("#bookingsList").on("click", ".send-message-button", function () {
        const bookingId = $(this).data("id");
        const input = $(`#messages-${bookingId}`).find(".message-input");
        sendMessage(bookingId, input);
    });
    $("#loadMoreNotificationsButton").on("click", function () {
        loadNotifications(true);
    });
    
    $("#markAllNotificationsReadButton").on("click", markAllNotificationsAsRead);
    
    $("#ownerNotificationsList").on("click", ".read-notification-button", function () {
        markNotificationAsRead($(this).data("id"));
    });
    
    $("#ownerNotificationsList").on("click", ".delete-notification-button", function () {
        deleteNotification($(this).data("id"));
    });
    $(document).on("submit", ".payment-form", function (event) {
        event.preventDefault();
        const bookingId = $(this).data("id");
        const method = $(this).find(".payment-method").val();
        payBooking(bookingId, method);
    });
});