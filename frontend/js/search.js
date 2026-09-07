const API_BASE_URL = "http://localhost:4000/api";

let allServices = [];
let ownerPets = [];
let availabilityDays = [];
let selectedBookingDraft = null;

function getToken() {
    return localStorage.getItem("petsitterhubToken");
}

function getUser() {
    const savedUser = localStorage.getItem("petsitterhubUser");
    return savedUser ? JSON.parse(savedUser) : null;
}

function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiRequest(path, options = {}) {
    return $.ajax({
        url: `${API_BASE_URL}${path}`,
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders()
        },
        contentType: "application/json",
        dataType: "json",
        data: options.body ? JSON.stringify(options.body) : undefined
    });
}

function formatMoney(value) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function petTypeLabel(petType) {
    const labels = {
        cane: "Cane",
        gatto: "Gatto",
        roditore: "Roditore",
        rettile: "Rettile",
        uccello: "Uccello"
    };

    return labels[petType] || petType;
}

function priceUnitText(priceUnit) {
    const labels = {
        hourly: "tariffa oraria",
        daily: "tariffa giornaliera",
        fixed: "tariffa fissa"
    };

    return labels[priceUnit] || "tariffa";
}

function getInitials(firstName, lastName) {
    return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
}

function currentUserIsOwner() {
    const user = getUser();
    return Boolean(user && user.role === "owner" && getToken());
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDateLabel(dateValue) {
    return new Date(`${dateValue}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

function formatSlotTime(value) {
    return new Date(value).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome"
    });
}

function formatBookingDateTime(value) {
    return new Date(value).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome"
    });
}

function bookingPeriodText(priceUnit, startsAt, endsAt) {
    if (priceUnit === "fixed") {
        return `Data e ora: ${formatBookingDateTime(startsAt)}`;
    }

    return `Inizio: ${formatBookingDateTime(startsAt)} · Fine: ${formatBookingDateTime(endsAt)}`;
}

function defaultStartTime() {
    return "08:00";
}

function defaultEndTime() {
    return "20:00";
}

function nextDateValues(days = 45) {
    const dates = [];
    const today = new Date();

    for (let index = 0; index < days; index += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + index);
        dates.push(formatDateForInput(date));
    }

    return dates;
}

function renderAvatar(sitter) {
    if (sitter.profile_image_url) {
        return `<div class="sitter-avatar sitter-avatar-image" style="background-image: url('${sitter.profile_image_url}')"></div>`;
    }

    return `<div class="sitter-avatar">${getInitials(sitter.first_name, sitter.last_name)}</div>`;
}

function renderRating(sitter) {
    const reviewCount = Number(sitter.review_count || 0);

    if (!reviewCount) {
        return '<span class="text-muted">Nessuna recensione</span>';
    }

    return `
        <span class="fw-semibold">${Number(sitter.average_rating || 0).toFixed(1)}/5</span>
        <span class="text-muted">su ${reviewCount} recensioni</span>
        <button class="btn btn-link btn-sm p-0 show-reviews" type="button" data-sitter-id="${sitter.id}" data-sitter-name="${sitter.first_name} ${sitter.last_name}">
            Vedi recensioni
        </button>
    `;
}

function selectedOwnerPet() {
    if (!currentUserIsOwner()) {
        return null;
    }

    return ownerPets.find(function (pet) {
        return String(pet.id) === String($("#petType").val());
    }) || null;
}

function ownerPetTypes() {
    return uniqueValues(ownerPets.map((pet) => pet.species));
}

function selectedFilterPetType() {
    const selectedPet = selectedOwnerPet();

    if (selectedPet) {
        return selectedPet.species;
    }

    if (currentUserIsOwner()) {
        return "";
    }

    return $("#petType").val();
}

function serviceMatchesCurrentFilters(service) {
    const selectedService = $("#service").val();
    const petType = selectedFilterPetType();

    if (selectedService && service.name !== selectedService) {
        return false;
    }

    if (petType && service.pet_type !== petType) {
        return false;
    }

    if (currentUserIsOwner() && !petType) {
        return ownerPetTypes().includes(service.pet_type);
    }

    return true;
}

function visibleServicesForSitter(sitter) {
    return (sitter.services || []).filter(serviceMatchesCurrentFilters);
}

function sitterMatchesCurrentOwnerPets(sitter) {
    if (!currentUserIsOwner() || selectedFilterPetType()) {
        return true;
    }

    const allowedPetTypes = ownerPetTypes();

    return (sitter.services || []).some(function (service) {
        return allowedPetTypes.includes(service.pet_type);
    });
}

function groupServicesByPetType(services) {
    return (services || []).reduce(function (groups, service) {
        if (!groups[service.pet_type]) {
            groups[service.pet_type] = [];
        }

        groups[service.pet_type].push(service);
        return groups;
    }, {});
}

function renderServicePanel(sitter, petType, services, active) {
    return `
        <div class="sitter-service-panel ${active ? "" : "d-none"}" data-pet-type="${petType}">
            ${services.map(function (service) {
                return `
                    <div class="sitter-service-row">
                        <div>
                            <strong>${service.name}</strong>
                            <span class="d-block text-muted small">${petTypeLabel(service.pet_type)} - ${priceUnitText(service.price_unit)}</span>
                        </div>
                        <div class="text-end">
                            <strong class="d-block">${formatMoney(service.price)}</strong>
                            <button class="btn btn-primary btn-sm book-service" type="button"
                                data-sitter-id="${sitter.id}"
                                data-sitter-name="${sitter.first_name} ${sitter.last_name}"
                                data-service-id="${service.id}"
                                data-service-name="${service.name}"
                                data-pet-type="${service.pet_type}"
                                data-price-unit="${service.price_unit}"
                                data-availability-mode="${service.availability_mode}">
                                Prenota
                            </button>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderSitterServices(sitter) {
    const groups = groupServicesByPetType(visibleServicesForSitter(sitter));
    const petTypes = Object.keys(groups);

    if (!petTypes.length) {
        return '<div class="text-muted">Nessun servizio configurato.</div>';
    }

    return `
        <div class="sitter-pet-tabs mb-3">
            ${petTypes.map(function (petType, index) {
                return `
                    <button class="btn btn-sm ${index === 0 ? "btn-primary" : "btn-outline-primary"} sitter-pet-tab" type="button" data-pet-type="${petType}">
                        ${petTypeLabel(petType)}
                    </button>
                `;
            }).join("")}
        </div>
        ${petTypes.map(function (petType, index) {
            return renderServicePanel(sitter, petType, groups[petType], index === 0);
        }).join("")}
    `;
}

function renderSitters(sitters) {
    const minRating = Number($("#minRating").val() || 0);
    const filteredSitters = minRating
        ? sitters.filter((sitter) => Number(sitter.average_rating || 0) >= minRating && sitterMatchesCurrentOwnerPets(sitter))
        : sitters.filter(sitterMatchesCurrentOwnerPets);

    if (!filteredSitters.length) {
        $("#sittersList").html(`
            <div class="col-12">
                <div class="empty-state">Nessun sitter trovato con i filtri selezionati.</div>
            </div>
        `);
        return;
    }

    $("#sittersList").html(filteredSitters.map(function (sitter) {
        return `
            <div class="col-md-6 col-xl-4">
                <article class="sitter-card h-100">
                    <div class="d-flex gap-3 align-items-start mb-3">
                        ${renderAvatar(sitter)}
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start gap-2">
                                <div>
                                    <h3 class="h5 mb-1">${sitter.first_name} ${sitter.last_name}</h3>
                                    <p class="text-muted mb-1">${sitter.base_city}</p>
                                    <div class="rating-line">${renderRating(sitter)}</div>
                                </div>
                                ${sitter.verified ? '<span class="badge text-bg-success">Verificato</span>' : ""}
                            </div>
                        </div>
                    </div>
                    <p class="sitter-bio">${sitter.bio || "Bio non disponibile."}</p>
                    ${renderSitterServices(sitter)}
                </article>
            </div>
        `;
    }).join(""));
}

function renderPetTypeOptions(availablePetTypes) {
    const currentValue = $("#petType").val();
    const options = ['<option value="">Tutti gli animali</option>'];

    availablePetTypes.forEach(function (petType) {
        options.push(`<option value="${petType}">${petTypeLabel(petType)}</option>`);
    });

    $("#petType").html(options.join(""));

    if (availablePetTypes.includes(currentValue)) {
        $("#petType").val(currentValue);
    }
}

function renderOwnerPetOptions() {
    const currentValue = $("#petType").val();
    const options = ['<option value="">Tutti i miei animali</option>'];

    ownerPets.forEach(function (pet) {
        options.push(`<option value="${pet.id}">${pet.name} (${petTypeLabel(pet.species)})</option>`);
    });

    $("#petType").html(options.join(""));

    if (ownerPets.some((pet) => String(pet.id) === String(currentValue))) {
        $("#petType").val(currentValue);
    }
}

function renderServiceOptions(availableServices) {
    const currentValue = $("#service").val();
    const options = ['<option value="">Tutti i servizi</option>'];

    availableServices.forEach(function (service) {
        options.push(`<option value="${service.name}">${service.name}</option>`);
    });

    $("#service").html(options.join(""));

    if (availableServices.some((service) => service.name === currentValue)) {
        $("#service").val(currentValue);
    }
}

function syncFilterOptions(changedFilter) {
    if (currentUserIsOwner()) {
        syncOwnerFilterOptions();
        return;
    }

    const selectedPetType = $("#petType").val();
    const selectedService = $("#service").val();
    let petTypes = [];
    let services = allServices;

    if (selectedPetType && changedFilter !== "service") {
        services = allServices.filter((service) => (service.pet_types || []).includes(selectedPetType));
    }

    if (selectedService && changedFilter !== "pet") {
        const service = allServices.find((item) => item.name === selectedService);
        petTypes = service ? service.pet_types || [] : [];
    } else {
        petTypes = uniqueValues(allServices.flatMap((service) => service.pet_types || []));
    }

    renderPetTypeOptions(petTypes);
    renderServiceOptions(services);

    if (selectedPetType && petTypes.includes(selectedPetType)) {
        $("#petType").val(selectedPetType);
    }

    if (selectedService && services.some((service) => service.name === selectedService)) {
        $("#service").val(selectedService);
    }
}

function syncOwnerFilterOptions() {
    const selectedPet = selectedOwnerPet();
    const selectedPetType = selectedPet ? selectedPet.species : "";
    const allowedPetTypes = selectedPetType ? [selectedPetType] : ownerPetTypes();
    const availableServices = allServices.filter(function (service) {
        return (service.pet_types || []).some((petType) => allowedPetTypes.includes(petType));
    });

    renderOwnerPetOptions();
    renderServiceOptions(availableServices);
}

function currentFilters() {
    const filters = {
        city: $("#city").val(),
        service: $("#service").val()
    };

    const petType = selectedFilterPetType();

    if (petType) {
        filters.petType = petType;
    }

    return filters;
}

function showMissingPetsMessage() {
    $("#sittersList").html(`
        <div class="col-12">
            <div class="empty-state text-danger">Prima di cercare o prenotare devi aggiungere almeno un animale nella dashboard.</div>
        </div>
    `);
}

function loadServices() {
    return $.get(`${API_BASE_URL}/services`, function (response) {
        allServices = response.services || [];
        syncFilterOptions();
    });
}

function loadOwnerPets() {
    return apiRequest("/pets").done(function (response) {
        ownerPets = response.pets || [];

        if (!ownerPets.length) {
            showMissingPetsMessage();
            return;
        }

        syncOwnerFilterOptions();
        loadSitters(currentFilters());
    }).fail(function () {
        ownerPets = [];
        showMissingPetsMessage();
    });
}

function loadSitters(filters = {}) {
    $("#sittersList").html(`
        <div class="col-12">
            <div class="empty-state">Caricamento sitter...</div>
        </div>
    `);

    $.get(`${API_BASE_URL}/sitters`, filters, function (response) {
        renderSitters(response.sitters || []);
    }).fail(function () {
        $("#sittersList").html(`
            <div class="col-12">
                <div class="empty-state text-danger">Errore durante il caricamento dei sitter.</div>
            </div>
        `);
    });
}

function saveBookingDraft(button) {
    selectedBookingDraft = {
        sitterId: button.data("sitter-id"),
        sitterName: button.data("sitter-name"),
        serviceId: button.data("service-id"),
        serviceName: button.data("service-name"),
        petType: button.data("pet-type"),
        priceUnit: button.data("price-unit"),
        availabilityMode: button.data("availability-mode")
    };
}

function renderBookingPetOptions() {
    const compatiblePets = ownerPets.filter((pet) => pet.species === selectedBookingDraft.petType);

    $("#bookingPet").html(compatiblePets.map(function (pet) {
        return `<option value="${pet.id}">${pet.name} (${petTypeLabel(pet.species)})</option>`;
    }).join(""));
}

function resetBookingQuote() {
    $("#bookingServiceLabel").text(`${selectedBookingDraft.serviceName} - ${priceUnitText(selectedBookingDraft.priceUnit)}`);
    $("#bookingTotal").text("--");
    $("#bookingQuoteDetails").text("Il totale viene calcolato prima della conferma.");
}

function showBookingMessage(message) {
    $("#bookingMessage").removeClass("d-none").text(message);
}

function clearBookingMessage() {
    $("#bookingMessage").addClass("d-none").text("");
}

function setBookingSubmitDisabled(disabled) {
    $("#bookingSubmitButton").prop("disabled", disabled);
}

function renderDateOptions(selector, dates) {
    if (!dates.length) {
        $(selector).html('<option value="">Nessuna data disponibile</option>');
        return;
    }

    $(selector).html(dates.map(function (date) {
        return `<option value="${date}">${formatDateLabel(date)}</option>`;
    }).join(""));
}

function consecutiveDailyEndDates(startDate) {
    const availableDates = availabilityDays.map((day) => day.date);
    const startIndex = availableDates.indexOf(startDate);
    const dates = [];

    if (startIndex === -1) {
        return dates;
    }

    for (let index = startIndex; index < availableDates.length; index += 1) {
        const previousDate = dates[dates.length - 1];
        const currentDate = availableDates[index];

        if (previousDate) {
            const expected = new Date(`${previousDate}T12:00:00`);
            expected.setDate(expected.getDate() + 1);

            if (formatDateForInput(expected) !== currentDate) {
                break;
            }
        }

        dates.push(currentDate);
    }

    return dates;
}

function renderHourlyTimes() {
    const date = $("#bookingDate").val();
    const day = availabilityDays.find((item) => item.date === date);
    const slots = day ? day.slots : [];

    if (!slots.length) {
        $("#bookingStartTime").html('<option value="">Nessun orario disponibile</option>');
        $("#bookingEndTime").html('<option value="">Nessun orario disponibile</option>');
        setBookingSubmitDisabled(true);
        return;
    }

    $("#bookingStartTime").html(slots.map(function (slot) {
        return `<option value="${slot.startsAt}">${formatSlotTime(slot.startsAt)}</option>`;
    }).join(""));

    renderEndTimeOptions();
}

function renderEndTimeOptions() {
    const startsAt = $("#bookingStartTime").val();
    const date = $("#bookingDate").val();
    const day = availabilityDays.find((item) => item.date === date);
    const slots = day ? day.slots : [];
    const selectedSlot = slots.find((slot) => slot.startsAt === startsAt);

    if (!selectedSlot) {
        $("#bookingEndTime").html('<option value="">Nessun orario disponibile</option>');
        setBookingSubmitDisabled(true);
        return;
    }

    $("#bookingEndTime").html(
        `<option value="${selectedSlot.endsAt}">${formatSlotTime(selectedSlot.endsAt)}</option>`
    );

    syncBookingDateTimes();
    checkAvailabilityAndQuote();
}

function syncBookingDateTimes() {
    if (selectedBookingDraft.priceUnit === "daily") {
        syncDailyDatesFromSelectedSlots();
        return;
    }

    const startsAt = $("#bookingStartTime").val();
    const endsAt = $("#bookingEndTime").val();

    $("#bookingStart").val(startsAt || "");
    $("#bookingEnd").val(endsAt || "");
}

function renderDailyEndDates() {
    const startDate = $("#bookingStartDateDaily").val();
    const dates = startDate ? consecutiveDailyEndDates(startDate) : availabilityDays.map((day) => day.date);

    renderDateOptions("#bookingEndDateDaily", dates);
    $("#bookingEndDateDaily").val(startDate);
    syncBookingDateTimes();
    checkAvailabilityAndQuote();
}

function renderBookingDates() {
    const dates = availabilityDays.map((day) => day.date);

    if (selectedBookingDraft.priceUnit === "daily") {
        renderDateOptions("#bookingStartDateDaily", dates);
        renderDailyEndDates();
        return;
    }

    renderDateOptions("#bookingDate", dates);
    renderHourlyTimes();
}

function loadAvailabilitySlots() {
    const from = formatDateForInput(new Date());
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 30);
    const to = formatDateForInput(toDate);

    setBookingSubmitDisabled(true);
    availabilityDays = [];

    apiRequest(`/sitters/${selectedBookingDraft.sitterId}/availability/slots?from=${from}&to=${to}&serviceId=${selectedBookingDraft.serviceId}`)
        .done(function (response) {
            availabilityDays = response.days || [];

            if (!availabilityDays.length) {
                showBookingMessage("Nessuna data disponibile per questo servizio.");
                return;
            }

            renderBookingDates();
        })
        .fail(function (xhr) {
            showBookingMessage(xhr.responseJSON?.error || "Disponibilità non caricata.");
        });
}

function checkAvailabilityAndQuote() {
    const petId = $("#bookingPet").val();

    syncBookingDateTimes();
    clearBookingMessage();
    resetBookingQuote();

    const startsAt = $("#bookingStart").val();
    const endsAt = $("#bookingEnd").val();

    if (!selectedBookingDraft || !petId || !startsAt || !endsAt) {
        setBookingSubmitDisabled(true);
        return;
    }

    if (new Date(startsAt) >= new Date(endsAt)) {
        showBookingMessage("La data di fine deve essere successiva alla data di inizio.");
        setBookingSubmitDisabled(true);
        return;
    }

    setBookingSubmitDisabled(true);

    apiRequest("/bookings/quote", {
        method: "POST",
        body: {
            petId,
            sitterId: selectedBookingDraft.sitterId,
            serviceId: selectedBookingDraft.serviceId,
            startsAt,
            endsAt
        }
    }).done(function (response) {
        const quote = response.quote;

        $("#bookingServiceLabel").text(`${quote.serviceName} per ${petTypeLabel(quote.petType)}`);
        $("#bookingTotal").text(formatMoney(quote.totalPrice));
        $("#bookingQuoteDetails").html(`
            <span class="d-block">${formatMoney(quote.price)} - ${priceUnitText(quote.priceUnit)}</span>
            <span class="d-block mt-1">${bookingPeriodText(quote.priceUnit, startsAt, endsAt)}</span>
        `);
        setBookingSubmitDisabled(false);
    }).fail(function (xhr) {
        showBookingMessage(xhr.responseJSON?.error || "Preventivo non disponibile.");
    });
}

function syncDailyDatesFromSelectedSlots() {
    const startDate = $("#bookingStartDateDaily").val();
    const endDate = $("#bookingEndDateDaily").val();
    const startDay = availabilityDays.find((day) => day.date === startDate);
    const endDay = availabilityDays.find((day) => day.date === endDate);

    if (!startDay || !endDay || !startDay.slots.length || !endDay.slots.length) {
        $("#bookingStart").val("");
        $("#bookingEnd").val("");
        return;
    }

    $("#bookingStart").val(startDay.slots[0].startsAt);
    $("#bookingEnd").val(endDay.slots[endDay.slots.length - 1].endsAt);
}

function openBookingModal(button) {
    saveBookingDraft(button);

    if (!getToken()) {
        window.location.href = "pages/login.html";
        return;
    }

    if (!currentUserIsOwner()) {
        alert("Solo un proprietario può prenotare un servizio.");
        return;
    }

    if (!ownerPets.length) {
        showMissingPetsMessage();
        return;
    }

    const compatiblePets = ownerPets.filter((pet) => pet.species === selectedBookingDraft.petType);

    if (!compatiblePets.length) {
        alert(`Non hai animali compatibili con ${selectedBookingDraft.serviceName}.`);
        return;
    }

    $("#bookingForm")[0].reset();
    clearBookingMessage();
    renderBookingPetOptions();
    $("#bookingSummary").text(`${selectedBookingDraft.serviceName} con ${selectedBookingDraft.sitterName} - ${priceUnitText(selectedBookingDraft.priceUnit)}`);
    resetBookingQuote();
    setBookingSubmitDisabled(true);

    if (selectedBookingDraft.priceUnit === "daily") {
        $("#bookingHourlySection").addClass("d-none");
        $("#bookingDailySection").removeClass("d-none");
    } else {
        $("#bookingDailySection").addClass("d-none");
        $("#bookingHourlySection").removeClass("d-none");
        $("#bookingEndTimeGroup").toggleClass("d-none", selectedBookingDraft.priceUnit === "fixed");
    }

    loadAvailabilitySlots();
    bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingModal")).show();
}

function showReviews(sitterId, sitterName) {
    $("#reviewsModalTitle").text(`Recensioni di ${sitterName}`);
    $("#reviewsModalBody").html('<p class="text-muted mb-0">Caricamento recensioni...</p>');
    bootstrap.Modal.getOrCreateInstance(document.getElementById("reviewsModal")).show();

    $.get(`${API_BASE_URL}/sitters/${sitterId}/reviews`, function (response) {
        if (!response.reviews.length) {
            $("#reviewsModalBody").html('<p class="text-muted mb-0">Nessuna recensione disponibile.</p>');
            return;
        }

        $("#reviewsModalBody").html(response.reviews.map(function (review) {
            return `
                <article class="review-item">
                    <div class="d-flex justify-content-between gap-3">
                        <strong>${review.owner_first_name} ${review.owner_last_name}</strong>
                        <span>${review.rating}/5</span>
                    </div>
                    <p class="mb-1">${review.comment || "Nessun commento."}</p>
                    <small class="text-muted">${new Date(review.created_at).toLocaleDateString("it-IT")}</small>
                </article>
            `;
        }).join(""));
    }).fail(function () {
        $("#reviewsModalBody").html('<p class="text-danger mb-0">Impossibile caricare le recensioni.</p>');
    });
}

$(document).ready(function () {
    $.when(loadServices()).always(function () {
        if (currentUserIsOwner()) {
            loadOwnerPets();
        } else {
            loadSitters();
        }
    });

    $("#searchForm").on("submit", function (event) {
        event.preventDefault();

        if (currentUserIsOwner() && !ownerPets.length) {
            showMissingPetsMessage();
            return;
        }

        loadSitters(currentFilters());
    });

    $("#resetFilters").on("click", function () {
        $("#searchForm")[0].reset();

        if (currentUserIsOwner()) {
            loadOwnerPets();
            return;
        }

        syncFilterOptions();
        loadSitters();
    });

    $("#petType").on("change", function () {
        syncFilterOptions("pet");
        loadSitters(currentFilters());
    });

    $("#service").on("change", function () {
        syncFilterOptions("service");
        loadSitters(currentFilters());
    });

    $("#minRating").on("change", function () {
        loadSitters(currentFilters());
    });

    $("#sittersList").on("click", ".sitter-pet-tab", function () {
        const button = $(this);
        const card = button.closest(".sitter-card");
        const petType = button.data("pet-type");

        card.find(".sitter-pet-tab").removeClass("btn-primary").addClass("btn-outline-primary");
        button.removeClass("btn-outline-primary").addClass("btn-primary");
        card.find(".sitter-service-panel").addClass("d-none");
        card.find(`.sitter-service-panel[data-pet-type="${petType}"]`).removeClass("d-none");
    });

    $("#sittersList").on("click", ".book-service", function () {
        openBookingModal($(this));
    });

    $("#sittersList").on("click", ".show-reviews", function () {
        showReviews($(this).data("sitter-id"), $(this).data("sitter-name"));
    });

    $("#bookingPet").on("change", checkAvailabilityAndQuote);
    $("#bookingDate").on("change", function () {
        syncBookingDateTimes();
        checkAvailabilityAndQuote();
    });
    $("#bookingStartTime").on("change", renderEndTimeOptions);
    $("#bookingEndTime").on("change", checkAvailabilityAndQuote);
    $("#bookingStartDateDaily").on("change", renderDailyEndDates);
    $("#bookingEndDateDaily").on("change", checkAvailabilityAndQuote);

    $("#bookingForm").on("submit", function (event) {
        event.preventDefault();

        const petId = $("#bookingPet").val();
        const startsAt = $("#bookingStart").val();
        const endsAt = $("#bookingEnd").val();

        clearBookingMessage();

        if (!selectedBookingDraft || !petId || !startsAt || !endsAt) {
            showBookingMessage("Completa tutti i dati della prenotazione.");
            return;
        }

        apiRequest("/bookings", {
            method: "POST",
            body: {
                petId,
                sitterId: selectedBookingDraft.sitterId,
                serviceId: selectedBookingDraft.serviceId,
                startsAt,
                endsAt,
                notes: $("#bookingNotes").val()
            }
        }).done(function (response) {
            bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingModal")).hide();
            $("#bookingResultBody").html(`
                <p class="mb-2">La richiesta è stata inviata al sitter.</p>
                <p class="mb-0 text-muted">Potrai pagare dalla dashboard dopo l'accettazione.</p>
            `);
            bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingResultModal")).show();
            loadSitters(currentFilters());
        }).fail(function (xhr) {
            showBookingMessage(xhr.responseJSON?.error || "Errore durante la prenotazione.");
        });
    });
});
