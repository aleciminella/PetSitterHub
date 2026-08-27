const API_BASE_URL = "http://localhost:4000/api";
let petsCache = [];
let bookingsOffset = 0;
let bookingsHasMore = false;
const BOOKINGS_LIMIT = 5;

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
                        ${getBookingStatusLabel(booking.status)}
                    </span>
                </div>
                ${["pending", "accepted"].includes(booking.status) ? `
                    <div class="mt-3">
                        <button class="btn btn-outline-danger btn-sm cancel-booking-button" type="button" data-id="${booking.id}">
                            Annulla
                        </button>
                    </div>
                ` : ""}
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

$(document).ready(function () {
    if (!guardOwnerDashboard()) {
        return;
    }

    loadPets();
    loadBookings();
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
});