const API_BASE_URL = "http://localhost:4000/api";
const PET_TYPES = [
    { value: "cane", label: "Cane" },
    { value: "gatto", label: "Gatto" },
    { value: "uccello", label: "Uccello" },
    { value: "roditore", label: "Roditore" },
    { value: "rettile", label: "Rettile" }
];
const WEEK_DAYS = [
    { value: 1, label: "Lunedì" },
    { value: 2, label: "Martedì" },
    { value: 3, label: "Mercoledì" },
    { value: 4, label: "Giovedì" },
    { value: 5, label: "Venerdì" },
    { value: 6, label: "Sabato" },
    { value: 0, label: "Domenica" }
];

let availabilityExceptions = [];
let notificationsOffset = 0;
let notificationsHasMore = false;
const NOTIFICATIONS_LIMIT = 3;
let sitterBookingsOffset = 0;
let sitterBookingsHasMore = false;
const SITTER_BOOKINGS_LIMIT = 5;

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

function guardSitterDashboard() {
    const user = getSavedUser();
    const token = getSavedToken();
    if (!user || !token || user.role !== "sitter") {
        window.location.href = "login.html";
        return false;
    }
    return true;
}

function showMessage(selector, type, text) {
    $(selector)
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function hideMessage(selector) {
    $(selector)
        .addClass("d-none")
        .removeClass("alert-success alert-danger")
        .text("");
}

function getPetTypeLabel(value) {
    const petType = PET_TYPES.find(function (item) {
        return item.value === value;
    });
    return petType ? petType.label : value;
}

function getPriceUnitLabel(priceUnit) {
    const labels = {
        hourly: "Tariffa oraria",
        daily: "Tariffa giornaliera",
        fixed: "Prezzo fisso"
    };
    return labels[priceUnit] || priceUnit;
}

function userInitials(user) {
    return `${(user.first_name || "").charAt(0)}${(user.last_name || "").charAt(0)}`.toUpperCase() || "PS";
}

function updateProfileImagePreview(imageUrl) {
    const preview = $("#profileImagePreview");
    const user = getSavedUser() || {};

    preview.text(userInitials(user));
    preview.css("background-image", "none");

    if (imageUrl) {
        preview.text("");
        preview.css("background-image", `url('${imageUrl}')`);
    }
}

function resizeProfileImage(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.onload = function (event) {
            const image = new Image();

            image.onload = function () {
                const maxSize = 480;
                const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);

                const context = canvas.getContext("2d");
                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };

            image.onerror = reject;
            image.src = event.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadProfile() {
    $.ajax({
        url: `${API_BASE_URL}/sitters/me`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const profile = response.profile || {};
            $("#baseCity").val(profile.base_city || profile.city || "");
            $("#profileImageUrl").val(profile.profile_image_url || "");
            updateProfileImagePreview(profile.profile_image_url || "");
            $("#bio").val(profile.bio || "");
        },
        error: function () {
            showMessage("#profileMessage", "danger", "Errore durante il caricamento del profilo.");
        }
    });
}

function saveProfile(event) {
    event.preventDefault();
    hideMessage("#profileMessage");
    $.ajax({
        url: `${API_BASE_URL}/sitters/me`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            baseCity: $("#baseCity").val(),
            profileImageUrl: $("#profileImageUrl").val(),
            bio: $("#bio").val()
        }),
        success: function () {
            showMessage("#profileMessage", "success", "Profilo salvato correttamente.");
            loadProfile();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio del profilo.";
            showMessage("#profileMessage", "danger", message);
        }
    });
}

function renderPetTypes(selectedPetTypes) {
    $("#petTypesList").html(PET_TYPES.map(function (petType) {
        const checked = selectedPetTypes.includes(petType.value) ? "checked" : "";
        return `
            <div class="col-md-6">
                <label class="pet-type-check d-flex gap-2 align-items-center">
                    <input class="form-check-input m-0 pet-type-input" type="checkbox" value="${petType.value}" ${checked}>
                    <span>${petType.label}</span>
                </label>
            </div>
        `;
    }).join(""));
}

function loadPetTypes() {
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/pet-types`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderPetTypes(response.petTypes || []);
        },
        error: function () {
            showMessage("#petTypesMessage", "danger", "Errore durante il caricamento degli animali accettati.");
        }
    });
}

function getSelectedPetTypes() {
    return $(".pet-type-input:checked").map(function () {
        return $(this).val();
    }).get();
}

function savePetTypes(event) {
    event.preventDefault();
    hideMessage("#petTypesMessage");
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/pet-types`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            petTypes: getSelectedPetTypes()
        }),
        success: function () {
            showMessage("#petTypesMessage", "success", "Animali accettati salvati correttamente.");
            loadServices();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio degli animali accettati.";
            showMessage("#petTypesMessage", "danger", message);
        }
    });
}

function renderServices(services) {
    if (!services.length) {
        $("#sitterServicesList").html('<div class="empty-state">Seleziona almeno un animale accettato per configurare i servizi.</div>');
        return;
    }

    const groupedServices = services.reduce(function (groups, service) {
        if (!groups[service.pet_type]) {
            groups[service.pet_type] = [];
        }
        groups[service.pet_type].push(service);
        return groups;
    }, {});
    const petTypes = Object.keys(groupedServices);

    $("#sitterServicesList").html(`
        <div class="sitter-pet-tabs mb-3">
            ${petTypes.map(function (petType, index) {
                return `
                    <button class="btn btn-sm ${index === 0 ? "btn-primary" : "btn-outline-primary"} sitter-service-tab" type="button" data-pet-type="${petType}">
                        ${getPetTypeLabel(petType)}
                    </button>
                `;
            }).join("")}
        </div>
        ${petTypes.map(function (petType, index) {
            return `
                <div class="sitter-service-panel ${index === 0 ? "" : "d-none"}" data-pet-type="${petType}">
                    ${groupedServices[petType].map(function (service) {
                        const checked = service.enabled ? "checked" : "";
                        const price = service.price ? Number(service.price).toFixed(2) : "";
                        return `
                            <article class="sitter-service-row" data-service-id="${service.service_id}" data-pet-type="${service.pet_type}">
                                <div class="row align-items-center g-3">
                                    <div class="col-lg-6">
                                        <div class="form-check">
                                            <input class="form-check-input service-enabled-input" type="checkbox" ${checked}>
                                            <label class="form-check-label fw-bold">${service.name}</label>
                                        </div>
                                        <p class="text-muted mb-0">${service.description || ""}</p>
                                    </div>
                                    <div class="col-lg-3">
                                        <span class="text-muted">${getPriceUnitLabel(service.price_unit)}</span>
                                    </div>
                                    <div class="col-lg-3">
                                        <input class="form-control service-price-input" type="number" min="0" step="0.01" value="${price}" placeholder="Prezzo">
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join("")}
                </div>
            `;
        }).join("")}
    `);
}

function loadServices() {
    $("#sitterServicesList").html('<div class="empty-state">Caricamento servizi...</div>');
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/services`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderServices(response.services || []);
        },
        error: function () {
            $("#sitterServicesList").html('<div class="empty-state text-danger">Errore durante il caricamento dei servizi.</div>');
        }
    });
}

function getSelectedServices() {
    return $(".sitter-service-row").map(function () {
        const row = $(this);
        const enabled = row.find(".service-enabled-input").is(":checked");
        const price = row.find(".service-price-input").val();
        if (!enabled) {
            return null;
        }
        return {
            serviceId: row.data("service-id"),
            petType: row.data("pet-type"),
            price: price
        };
    }).get();
}

function saveServices(event) {
    event.preventDefault();
    hideMessage("#servicesMessage");
    const selectedServices = getSelectedServices();
    const hasMissingPrice = selectedServices.some(function (service) {
        return service.price === "";
    });

    if (hasMissingPrice) {
        showMessage("#servicesMessage", "danger", "Non hai inserito il prezzo per il servizio, riprovare");
        return;
    }

    $.ajax({
        url: `${API_BASE_URL}/sitters/me/services`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            services: selectedServices
        }),
        success: function () {
            showMessage("#servicesMessage", "success", "Servizi salvati correttamente.");
            loadServices();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio dei servizi.";
            showMessage("#servicesMessage", "danger", message);
        }
    });
}

function formatTime(value) {
    return value ? String(value).slice(0, 5) : "";
}

function formatDate(value) {
    if (!value) {
        return "";
    }
    return String(value).slice(0, 10);
}

function formatDateForDisplay(value) {
    const date = formatDate(value);

    if (!date) {
        return "";
    }

    return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT");
}

function renderWeeklyAvailability(weeklyAvailability) {
    $("#weeklyAvailabilityList").html(WEEK_DAYS.map(function (day) {
        const current = weeklyAvailability.find(function (item) {
            return Number(item.weekday) === day.value;
        }) || {};
        const checked = current.is_available ? "checked" : "";
        const disabled = current.is_available ? "" : "disabled";
        const rowClass = current.is_available ? "" : "weekly-availability-row-disabled";
        return `
            <div class="weekly-availability-row ${rowClass}" data-weekday="${day.value}">
                <div class="d-flex flex-column flex-lg-row gap-3 align-items-lg-center">
                    <div class="availability-day-name">${day.label}</div>
                    <label class="form-check d-flex gap-2 align-items-center mb-0">
                        <input class="form-check-input weekly-available-input" type="checkbox" ${checked}>
                        <span>Disponibile</span>
                    </label>
                    <input class="form-control availability-time-input weekly-start-input" type="time" value="${formatTime(current.starts_at)}" ${disabled}>
                    <input class="form-control availability-time-input weekly-end-input" type="time" value="${formatTime(current.ends_at)}" ${disabled}>
                </div>
            </div>
        `;
    }).join(""));
}

function renderAvailabilityExceptions() {
    if (!availabilityExceptions.length) {
        $("#availabilityExceptionsList").html('<div class="empty-state">Nessuna chiusura o data speciale configurata.</div>');
        return;
    }
    $("#availabilityExceptionsList").html(availabilityExceptions.map(function (exception, index) {
        const label = exception.isAvailable ? "Orario speciale" : "Chiusura";
        const timeText = exception.isAvailable ? `, ${exception.startsAt} - ${exception.endsAt}` : "";
        return `
            <article class="availability-exception-item">
                <div>
                    <h4 class="h6 mb-1">${label}</h4>
                    <p class="mb-1">Dal ${formatDateForDisplay(exception.startsOn)} al ${formatDateForDisplay(exception.endsOn)}${timeText}</p>
                    <p class="text-muted mb-0">${exception.note || "Nessuna nota."}</p>
                </div>
                <button class="btn btn-outline-danger btn-sm remove-exception-button" type="button" data-index="${index}">
                    Elimina
                </button>
            </article>
        `;
    }).join(""));
}

function loadAvailability() {
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/availability`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderWeeklyAvailability(response.weeklyAvailability || []);
            availabilityExceptions = (response.exceptions || []).map(function (exception) {
                return {
                    startsOn: formatDate(exception.starts_on),
                    endsOn: formatDate(exception.ends_on),
                    isAvailable: exception.is_available,
                    startsAt: formatTime(exception.starts_at),
                    endsAt: formatTime(exception.ends_at),
                    note: exception.note || ""
                };
            });
            renderAvailabilityExceptions();
        },
        error: function () {
            showMessage("#availabilityMessage", "danger", "Errore durante il caricamento della disponibilità.");
        }
    });
}

function getWeeklyAvailabilityData() {
    return $(".weekly-availability-row").map(function () {
        const row = $(this);
        const isAvailable = row.find(".weekly-available-input").is(":checked");
        return {
            weekday: Number(row.data("weekday")),
            isAvailable,
            startsAt: isAvailable ? row.find(".weekly-start-input").val() : null,
            endsAt: isAvailable ? row.find(".weekly-end-input").val() : null
        };
    }).get();
}

function saveWeeklyAvailability(event) {
    event.preventDefault();
    hideMessage("#availabilityMessage");
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/availability/weekly`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            weeklyAvailability: getWeeklyAvailabilityData()
        }),
        success: function () {
            showMessage("#availabilityMessage", "success", "Disponibilità settimanale salvata correttamente.");
            loadAvailability();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio della disponibilità.";
            showMessage("#availabilityMessage", "danger", message);
        }
    });
}

function saveAvailabilityExceptions() {
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/availability/exceptions`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            exceptions: availabilityExceptions
        }),
        success: function () {
            showMessage("#availabilityMessage", "success", "Chiusure e orari speciali salvati correttamente.");
            loadAvailability();
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio delle eccezioni.";
            showMessage("#availabilityMessage", "danger", message);
        }
    });
}

function addAvailabilityException(event) {
    event.preventDefault();
    hideMessage("#availabilityMessage");
    const isSpecial = $("#exceptionType").val() === "special";
    availabilityExceptions.push({
        startsOn: $("#exceptionStartsOn").val(),
        endsOn: $("#exceptionEndsOn").val(),
        isAvailable: isSpecial,
        startsAt: isSpecial ? $("#exceptionStartsAt").val() : null,
        endsAt: isSpecial ? $("#exceptionEndsAt").val() : null,
        note: $("#exceptionNote").val()
    });
    $("#exceptionForm")[0].reset();
    saveAvailabilityExceptions();
}

function removeAvailabilityException(index) {
    availabilityExceptions.splice(index, 1);
    saveAvailabilityExceptions();
}

function getBookingStatusLabel(status) {
    const labels = {
        pending: "In attesa di conferma",
        accepted: "Accettata",
        rejected: "Richiesta rifiutata",
        cancelled: "Annullata",
        completed: "Completata"
    };
    return labels[status] || status;
}

function getPaymentStatusLabel(booking) {
    if (booking.status === "pending") {
        return "In attesa di conferma";
    }
    if (booking.status === "rejected") {
        return "Richiesta rifiutata";
    }
    if (booking.status === "cancelled") {
        return "Annullata";
    }
    if (!booking.payment_id) {
        return booking.status === "accepted" ? "In attesa di pagamento" : "Pagamento non registrato";
    }
    if (booking.payment_method === "bank_transfer" && booking.payment_status === "authorized") {
        return "Bonifico da confermare";
    }
    if (booking.payment_status === "paid" || booking.payment_status === "authorized") {
        return "Pagamento ricevuto";
    }
    if (booking.payment_status === "refunded") {
        return "Rimborsato";
    }
    return booking.payment_status;
}

function renderSitterMessages(container, messages) {
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

function loadSitterMessages(bookingId) {
    const box = $(`#sitter-messages-${bookingId}`);
    const list = box.find(".booking-messages-list");
    list.html('<div class="text-muted">Caricamento messaggi...</div>');
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/messages`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            renderSitterMessages(list, response.messages || []);
            $(`#sitter-message-count-${bookingId}`).addClass("d-none").text("0");
            loadNotifications();
        },
        error: function () {
            list.html('<div class="text-danger">Errore durante il caricamento dei messaggi.</div>');
        }
    });
}

function sendSitterMessage(bookingId, input) {
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
            loadSitterMessages(bookingId);
        },
        error: function () {
            showMessage("#sitterBookingsMessage", "danger", "Errore durante l'invio del messaggio.");
        }
    });
}

function renderUnreadMessagesBadge(booking) {
    const unreadMessages = Number(booking.unread_messages || 0);

    return `
        <span class="message-count-badge ${unreadMessages > 0 ? "" : "d-none"}" id="sitter-message-count-${booking.id}">
            ${unreadMessages}
        </span>
    `;
}

function updateBookingStatus(bookingId, action) {
    $.ajax({
        url: `${API_BASE_URL}/bookings/${bookingId}/${action}`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadSitterBookings();
            loadNotifications();
        },
        error: function () {
            showMessage("#sitterBookingsMessage", "danger", "Errore durante l'aggiornamento della prenotazione.");
        }
    });
}

function confirmBankTransfer(paymentId) {
    $.ajax({
        url: `${API_BASE_URL}/payments/${paymentId}/confirm-bank-transfer`,
        method: "PATCH",
        headers: authHeaders(),
        success: function () {
            loadSitterBookings();
            loadNotifications();
        },
        error: function () {
            showMessage("#sitterBookingsMessage", "danger", "Errore durante la conferma del bonifico.");
        }
    });
}

function renderSitterBookings(bookings, append) {
    if (!append) {
        $("#sitterBookingsList").html("");
    }
    if (!bookings.length && !append) {
        $("#sitterBookingsList").html('<div class="empty-state">Nessuna prenotazione trovata.</div>');
        $("#loadMoreSitterBookingsButton").addClass("d-none");
        return;
    }
    const html = bookings.map(function (booking) {
        return `
            <article class="booking-card" data-id="${booking.id}">
                <div class="booking-card-header">
                    <div>
                        <h3 class="h5 mb-2">${booking.service_name}</h3>
                        <p class="mb-1">Cliente: ${booking.owner_first_name} ${booking.owner_last_name}</p>
                        <p class="mb-1">Animale: ${booking.pet_name} (${getPetTypeLabel(booking.pet_type)})</p>
                        <p class="mb-1">Dal ${formatDateTime(booking.starts_at)} al ${formatDateTime(booking.ends_at)}</p>
                        <p class="mb-1">Totale: ${formatMoney(booking.total_price)}</p>
                        <p class="mb-1">Pagamento: ${getPaymentStatusLabel(booking)}</p>
                        <p class="mb-0">${booking.notes || "Nessuna nota."}</p>
                    </div>
                    <span class="booking-status booking-status-${booking.status}">
                        ${getBookingStatusLabel(booking.status)}
                    </span>
                </div>
                <div class="d-flex flex-wrap gap-2 mt-3">
                    ${booking.status === "pending" ? `
                        <button class="btn btn-success btn-sm accept-booking-button" type="button" data-id="${booking.id}">Accetta</button>
                        <button class="btn btn-outline-danger btn-sm reject-booking-button" type="button" data-id="${booking.id}">Rifiuta</button>
                    ` : ""}
                    ${booking.status === "accepted" ? `
                        <button class="btn btn-outline-danger btn-sm cancel-sitter-booking-button" type="button" data-id="${booking.id}">Annulla</button>
                    ` : ""}
                    ${booking.payment_method === "bank_transfer" && booking.payment_status === "authorized" ? `
                        <button class="btn btn-outline-success btn-sm confirm-bank-transfer-button" type="button" data-payment-id="${booking.payment_id}">Conferma bonifico</button>
                    ` : ""}
                    <button class="btn btn-outline-secondary btn-sm toggle-sitter-messages-button position-relative" type="button" data-id="${booking.id}">
                        Messaggi
                        ${renderUnreadMessagesBadge(booking)}
                    </button>
                </div>
                <div class="booking-message-box d-none" id="sitter-messages-${booking.id}">
                    <div class="booking-messages-list mb-3"></div>
                    <div class="d-flex gap-2">
                        <input class="form-control message-input" type="text" placeholder="Scrivi un messaggio">
                        <button class="btn btn-primary send-sitter-message-button" type="button" data-id="${booking.id}">
                            Invia
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
    $("#sitterBookingsList").append(html);
    $("#loadMoreSitterBookingsButton").toggleClass("d-none", !sitterBookingsHasMore);
}

function loadSitterBookings(append = false) {
    if (!append) {
        sitterBookingsOffset = 0;
        $("#sitterBookingsList").html('<div class="empty-state">Caricamento prenotazioni...</div>');
    }
    const period = $("#sitterBookingPeriod").val() || "future";
    $.ajax({
        url: `${API_BASE_URL}/bookings?period=${period}&limit=${SITTER_BOOKINGS_LIMIT}&offset=${sitterBookingsOffset}`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const bookings = response.bookings || [];
            sitterBookingsHasMore = bookings.length === SITTER_BOOKINGS_LIMIT;
            sitterBookingsOffset += bookings.length;
            renderSitterBookings(bookings, append);
        },
        error: function () {
            $("#sitterBookingsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle prenotazioni.</div>');
            $("#loadMoreSitterBookingsButton").addClass("d-none");
        }
    });
}

function formatDateTime(value) {
    return new Date(value).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function renderNotifications(notifications, append) {
    if (!append) {
        $("#sitterNotificationsList").html("");
    }
    if (!notifications.length && !append) {
        $("#sitterNotificationsList").html('<div class="empty-state">Nessuna notifica.</div>');
        $("#loadMoreNotificationsButton").addClass("d-none");
        return;
    }
    const html = notifications.map(function (notification) {
        return `
            <article class="notification-item ${notification.is_read ? "" : "notification-unread"}">
                <div class="d-flex justify-content-between gap-3">
                    <div>
                        <strong>${notification.title}</strong>
                        <p class="mb-1">${notification.body}</p>
                        <small class="text-muted">${formatDateTime(notification.created_at)}</small>
                    </div>
                    <div class="d-flex gap-2 align-items-start">
                        ${notification.is_read ? "" : `<button class="btn btn-outline-primary btn-sm read-notification-button" type="button" data-id="${notification.id}">Segna come letta</button>`}
                        <button class="btn btn-outline-danger btn-sm delete-notification-button" type="button" data-id="${notification.id}">Elimina</button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
    $("#sitterNotificationsList").append(html);
    $("#loadMoreNotificationsButton").toggleClass("d-none", !notificationsHasMore);
}

function updateNotificationsControls(unreadCount, totalCount) {
    $("#sitterNotificationsBadge")
        .toggleClass("d-none", unreadCount === 0)
        .text(unreadCount);

    $("#markAllNotificationsReadButton").toggleClass("d-none", unreadCount === 0);
    $("#deleteAllNotificationsButton").toggleClass("d-none", totalCount === 0);
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
            updateNotificationsControls(response.unreadCount || 0, notificationsOffset);
            renderNotifications(notifications, append);
        },
        error: function () {
            $("#sitterNotificationsList").html('<div class="empty-state text-danger">Errore durante il caricamento delle notifiche.</div>');
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

function deleteAllNotifications() {
    $.ajax({
        url: `${API_BASE_URL}/notifications`,
        method: "DELETE",
        headers: authHeaders(),
        success: function () {
            loadNotifications();
        }
    });
}

$(document).ready(function () {
    if (!guardSitterDashboard()) {
        return;
    }

    loadProfile();
    loadPetTypes();
    loadServices();
    loadAvailability();
    loadNotifications();
    loadSitterBookings();

    $("#profileForm").on("submit", saveProfile);
    $("#petTypesForm").on("submit", savePetTypes);
    $("#servicesForm").on("submit", saveServices);
    $("#refreshServicesButton").on("click", loadServices);
    $("#refreshAvailabilityButton").on("click", loadAvailability);

    $("#sitterServicesList").on("click", ".sitter-service-tab", function () {
        const button = $(this);
        const petType = button.data("pet-type");

        $("#sitterServicesList .sitter-service-tab").removeClass("btn-primary").addClass("btn-outline-primary");
        button.removeClass("btn-outline-primary").addClass("btn-primary");
        $("#sitterServicesList .sitter-service-panel").addClass("d-none");
        $(`#sitterServicesList .sitter-service-panel[data-pet-type="${petType}"]`).removeClass("d-none");
    });

    $("#profileImageFile").on("change", function () {
        const file = this.files && this.files[0];

        if (!file) {
            return;
        }

        resizeProfileImage(file).then(function (imageUrl) {
            $("#profileImageUrl").val(imageUrl);
            updateProfileImagePreview(imageUrl);
        }).catch(function () {
            showMessage("#profileMessage", "danger", "Impossibile caricare l'immagine selezionata.");
        });
    });

    $("#weeklyAvailabilityList").on("change", ".weekly-available-input", function () {
        const row = $(this).closest(".weekly-availability-row");
        const enabled = $(this).is(":checked");
        row.toggleClass("weekly-availability-row-disabled", !enabled);
        row.find(".weekly-start-input, .weekly-end-input").prop("disabled", !enabled);
    });

    $("#weeklyAvailabilityForm").on("submit", saveWeeklyAvailability);
    $("#exceptionForm").on("submit", addAvailabilityException);

    $("#availabilityExceptionsList").on("click", ".remove-exception-button", function () {
        removeAvailabilityException(Number($(this).data("index")));
    });

    $("#exceptionType").on("change", function () {
        const isSpecial = $(this).val() === "special";
        $("#exceptionStartsAt, #exceptionEndsAt").prop("disabled", !isSpecial);
    });

    $("#exceptionType").trigger("change");

    $("#loadMoreNotificationsButton").on("click", function () {
        loadNotifications(true);
    });

    $("#markAllNotificationsReadButton").on("click", markAllNotificationsAsRead);
    $("#deleteAllNotificationsButton").on("click", deleteAllNotifications);

    $("#sitterNotificationsList").on("click", ".read-notification-button", function () {
        markNotificationAsRead($(this).data("id"));
    });

    $("#sitterNotificationsList").on("click", ".delete-notification-button", function () {
        deleteNotification($(this).data("id"));
    });

    $("#sitterBookingPeriod").on("change", function () {
        loadSitterBookings();
    });

    $("#loadMoreSitterBookingsButton").on("click", function () {
        loadSitterBookings(true);
    });

    $("#sitterBookingsList").on("click", ".accept-booking-button", function () {
        updateBookingStatus($(this).data("id"), "accept");
    });

    $("#sitterBookingsList").on("click", ".reject-booking-button", function () {
        updateBookingStatus($(this).data("id"), "reject");
    });

    $("#sitterBookingsList").on("click", ".cancel-sitter-booking-button", function () {
        updateBookingStatus($(this).data("id"), "cancel-by-sitter");
    });

    $("#sitterBookingsList").on("click", ".confirm-bank-transfer-button", function () {
        confirmBankTransfer($(this).data("payment-id"));
    });

    $("#sitterBookingsList").on("click", ".toggle-sitter-messages-button", function () {
        const bookingId = $(this).data("id");
        const box = $(`#sitter-messages-${bookingId}`);
        box.toggleClass("d-none");

        if (!box.hasClass("d-none")) {
            loadSitterMessages(bookingId);
        }
    });

    $("#sitterBookingsList").on("click", ".send-sitter-message-button", function () {
        const bookingId = $(this).data("id");
        const input = $(`#sitter-messages-${bookingId}`).find(".message-input");
        sendSitterMessage(bookingId, input);
    });
});
