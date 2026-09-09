const API_BASE_URL = "http://localhost:4000/api";

let allServices = [];
let ownerPets = [];
let availabilityDays = [];
let selectedBookingDraft = null; //  bozza temporanea della prenotazione

function getToken() { // prende token da localStorage
    return localStorage.getItem("petsitterhubToken");
}

function getUser() {  // prende user da localStorage
    const savedUser = localStorage.getItem("petsitterhubUser");
    return savedUser ? JSON.parse(savedUser) : null;
}

function authHeaders() { // Prepara l'intestazione Authorization: Bearer ... se sei loggato.
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiRequest(path, options = {}) { // manda richieste AJAX al backend con gli header giusti e il JSON formattato.
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





// Formattatori estetici:
function formatMoney(value) { // Trasforma un numero in euro
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function petTypeLabel(petType) { // Mette la maiuscola
    const labels = {
        cane: "Cane",
        gatto: "Gatto",
        roditore: "Roditore",
        rettile: "Rettile",
        uccello: "Uccello"
    };

    return labels[petType] || petType;
}

function priceUnitText(priceUnit) { // Scrive tariffa
    const labels = {
        hourly: "tariffa oraria",
        daily: "tariffa giornaliera",
        fixed: "tariffa fissa"
    };

    return labels[priceUnit] || "tariffa";
}

function getInitials(firstName, lastName) { // prende le iniziali per i sitter che non hanno foto profilo
    return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
}

function formatSlotTime(value) { // formatta ora per italia
    return new Date(value).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome"
    });
}

function formatBookingDateTime(value) { // formatta data per l'italia
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


function formatDateForInput(date) { // Prende una data e la trasforma nel formato standard internazionale dei computer: ANNO-MESE-GIORNO
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDateLabel(dateValue) { // Prende la stringa del computer e la trasforma in una scritta bella e leggibile per una persona italiana
    return new Date(`${dateValue}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}






function currentUserIsOwner() { // Restituisce true se chi naviga è un proprietario con token valido.
    const user = getUser();
    return Boolean(user && user.role === "owner" && getToken());
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
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

function renderAvatar(sitter) { // crea immagine profilo sitter (se non è stata messa mette iniziali di default)
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

function renderSitterServices(sitter) { // Disegna i pulsanti di selezione (cane, gatto ecc)
    const groups = groupServicesByPetType(visibleServicesForSitter(sitter)); // prende i servizi del sitter e li divide in scatoloni
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
            return renderServicePanel(sitter, petType, groups[petType], index === 0); //disegna le righe con il nome servizio, prezzo e pulsante prenota
        }).join("")}
    `;
}

function renderSitters(sitters) { // prende la lista dei sitter appena arrivata dal server e costruisce fisicamente i riquadri bianchi sullo schermo.
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

    $("#sittersList").html(filteredSitters.map(function (sitter) { // renderAvatar per foto profilo
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
    if (currentUserIsOwner()) { // Controlla se l'utente che sta guardando la pagina è un proprietario già loggato.
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

    if (selectedPetType && petTypes.includes(selectedPetType)) { // il browser di default si resetta e torna sulla prima voce in alto, così si rimette il valore selezionato
        $("#petType").val(selectedPetType);
    }

    if (selectedService && services.some((service) => service.name === selectedService)) {
        $("#service").val(selectedService);
    }
}

function syncOwnerFilterOptions() { // se proprietario mostra direttamente i nomi dei suoi animali
    const selectedPet = selectedOwnerPet();
    const selectedPetType = selectedPet ? selectedPet.species : "";
    const allowedPetTypes = selectedPetType ? [selectedPetType] : ownerPetTypes();
    const availableServices = allServices.filter(function (service) {
        return (service.pet_types || []).some((petType) => allowedPetTypes.includes(petType));
    });

    renderOwnerPetOptions();
    renderServiceOptions(availableServices);
}

function currentFilters() { // Raccoglie ciò che c'è scritto al momento nei campi del form di ricerca
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

function loadServices() { // Scarica il catalogo generale dei servizi dal backend (GET /services).
    return $.get(`${API_BASE_URL}/services`, function (response) { // scarica servizi dal server
        allServices = response.services || []; // Li salva in memoria
        syncFilterOptions(); // per farli comparire nel menu a tendina sullo schermo
    });
}

function loadOwnerPets() { // Se sei un proprietario, scarica i tuoi animali (GET /pets). Se non ne hai, ti mostra l'avviso rosso showMissingPetsMessage().
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

function loadSitters(filters = {}) { // Chiama GET /sitters passando i filtri.
    $("#sittersList").html(`
        <div class="col-12">
            <div class="empty-state">Caricamento sitter...</div>
        </div>
    `);

    $.get(`${API_BASE_URL}/sitters`, filters, function (response) {
        renderSitters(response.sitters || []); // disegna card a schermo
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

function renderHourlyTimes() { // riempe i menu a tendina
    const date = $("#bookingDate").val(); // Guarda quale giorno hai scelto nel menu #bookingDate
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

function renderEndTimeOptions() { // Guarda quale ora di inizio hai appena selezionato e prende automaticamente l'ora di fine di quello slot e la inserisce nel menu dell'ora di fine (#bookingEndTime). Infine lancia la sincronizzazione e il preventivo.
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

function syncBookingDateTimes() { // Nel form HTML ci sono due caselle nascoste (#bookingStart e #bookingEnd) che l'utente non vede con gli occhi. Questa funzione prende le scelte fatte nei menu (sia che siano a ore, sia che siano a giorni) e scrive la data e l'ora complete in formato ISO internazionale dentro a questi due campi nascosti, pronte per essere spedite al server.

    if (selectedBookingDraft.priceUnit === "daily") {
        syncDailyDatesFromSelectedSlots();
        return;
    }

    const startsAt = $("#bookingStartTime").val();
    const endsAt = $("#bookingEndTime").val();

    $("#bookingStart").val(startsAt || "");
    $("#bookingEnd").val(endsAt || "");
}

function renderDailyEndDates() { // riempe il menu a tendina
    const startDate = $("#bookingStartDateDaily").val();
    const dates = startDate ? consecutiveDailyEndDates(startDate) : availabilityDays.map((day) => day.date);

    renderDateOptions("#bookingEndDateDaily", dates);
    $("#bookingEndDateDaily").val(startDate);
    syncBookingDateTimes();
    checkAvailabilityAndQuote();
}

function renderBookingDates() {  // prende la lista grezza delle date e decidere su quali menù a tendina versarla.
    const dates = availabilityDays.map((day) => day.date);

    if (selectedBookingDraft.priceUnit === "daily") { // se è a giorni chiama renderDailyEndDates() per attivare i menu delle date di inizio e fine soggiorno
        renderDateOptions("#bookingStartDateDaily", dates); // Prende le date e le inserisce dentro al menù a tendina della data di inizio soggiorno
        renderDailyEndDates(); // Chiama subito la funzione che calcola e popola il menù della data di fine soggiorno (mostrando solo date consecutive senza ferie in mezzo).
        return;
    }

    // se ad ore
    renderDateOptions("#bookingDate", dates); // Prende le date e le inserisce dentro al menù a tendina della data.
    renderHourlyTimes(); // per la data scelta va a spescare gli slot liberi e popola orario di inizio e di fine
}

function loadAvailabilitySlots() { // chiede al backend orari di disponibilità
    const from = formatDateForInput(new Date()); // Data di OGGI
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 30);
    const to = formatDateForInput(toDate); // data fra 30 giorni

    setBookingSubmitDisabled(true); // mette il lucchetto al tasto Invia
    availabilityDays = []; // Svuota il cassetto degli orari

    apiRequest(`/sitters/${selectedBookingDraft.sitterId}/availability/slots?from=${from}&to=${to}&serviceId=${selectedBookingDraft.serviceId}`)
        .done(function (response) {
            availabilityDays = response.days || []; // salva i giorni nel cassetto

            if (!availabilityDays.length) { // se non ha nessuna disponibilità fa return
                showBookingMessage("Nessuna data disponibile per questo servizio.");
                return;
            }

            renderBookingDates(); // se ci sono giorni liberi esegui renderBookingDates()
        })
        .fail(function (xhr) {
            showBookingMessage(xhr.responseJSON?.error || "Disponibilità non caricata.");
        });
}

function checkAvailabilityAndQuote() { // serve per calcolare un preventivo in tempo reale e verificare la disponibilità del sitter prima che l'utente invii una richiesta di prenotazione
    const petId = $("#bookingPet").val();

    // Sincronizza le date, cancella eventuali messaggi di errore precedenti e azzera il preventivo visibile nell'interfaccia.
    syncBookingDateTimes();
    clearBookingMessage();
    resetBookingQuote();

    const startsAt = $("#bookingStart").val();
    const endsAt = $("#bookingEnd").val();

    if (!selectedBookingDraft || !petId || !startsAt || !endsAt) { // se manca qualcosa si interrompe
        setBookingSubmitDisabled(true);
        return;
    }

    if (new Date(startsAt) >= new Date(endsAt)) { // data di fine deve essere successiva a quella di inizio
        showBookingMessage("La data di fine deve essere successiva alla data di inizio.");
        setBookingSubmitDisabled(true);
        return;
    }

    setBookingSubmitDisabled(true); // Disabilita temporaneamente il pulsante di conferma per evitare doppi invii.

    apiRequest("/bookings/quote", { // chiamata per verificare che il sitter è libero e calcolare prezzi
        method: "POST",
        body: {
            petId,
            sitterId: selectedBookingDraft.sitterId,
            serviceId: selectedBookingDraft.serviceId,
            startsAt,
            endsAt
        }
    }).done(function (response) { // Se il server risponde con successo aggiorna l'interfaccia
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

function syncDailyDatesFromSelectedSlots() { // aiutante di syncBookingDateTimes per i servizi a giorni: prende l'orario di apertura del primo giorno del soggiorno e l'orario di chiusura dell'ultimo giorno e li unisce
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
    saveBookingDraft(button); // salva temporaneamente i dati del sitter e del servizio cliccato in selectedBookingDraft

    if (!getToken()) { // se non si ha token si viene reindirizzati alla pagina di login
        window.location.href = "pages/login.html";
        return;
    }

    if (!currentUserIsOwner()) { // se si è loggati ma non come proprietario manda il seguente alert
        alert("Solo un proprietario può prenotare un servizio.");
        return;
    }

    if (!ownerPets.length) { // controlla se ci sono animali registrati. Controllo di sicurezza due finestre (se nella seconda elimino l'animale e nella prima non aggiorno e schiaccio prenota va in crash)
        showMissingPetsMessage();
        return;
    }

    const compatiblePets = ownerPets.filter((pet) => pet.species === selectedBookingDraft.petType); // controlla che gli animali sono compatibili

    if (!compatiblePets.length) {
        alert(`Non hai animali compatibili con ${selectedBookingDraft.serviceName}.`);
        return;
    }

    $("#bookingForm")[0].reset(); // Svuota tutti i campi del modulo
    clearBookingMessage(); // Nasconde eventuali strisce gialle di errore rimaste aperte
    renderBookingPetOptions(); // Riempie il menu a tendina degli animali solo con i tuoi animali compatibili
    $("#bookingSummary").text(`${selectedBookingDraft.serviceName} con ${selectedBookingDraft.sitterName} - ${priceUnitText(selectedBookingDraft.priceUnit)}`); // Scrive il titoletto riepilogativo in alto
    resetBookingQuote(); // Rimette il prezzo a -- (in attesa che venga scelta la data).
    setBookingSubmitDisabled(true); //  Mette il lucchetto sul pulsante "Invia richiesta". Non si può inviare finché non scegli le date e il prezzo non è calcolato

    if (selectedBookingDraft.priceUnit === "daily") {
        // se il servizio è giornaliero nasconde le ore e mostra data inizio e fine
        $("#bookingHourlySection").addClass("d-none");
        $("#bookingDailySection").removeClass("d-none");
    } else {
        // se il servizio è orario nascondi data di fine e mostra ore
        $("#bookingDailySection").addClass("d-none");
        $("#bookingHourlySection").removeClass("d-none");
        $("#bookingEndTimeGroup").toggleClass("d-none", selectedBookingDraft.priceUnit === "fixed"); // nasconde orario di fine
    }

    loadAvailabilitySlots(); // fa chiamata GET /api/sitters/:id/availability/slots per farsi mandare i 30 giorni di disponibilità e popolare. Guarda nella dichiarazione.
    bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingModal")).show(); // mostra il modal prenotazione
}

function showReviews(sitterId, sitterName) {
    $("#reviewsModalTitle").text(`Recensioni di ${sitterName}`);
    $("#reviewsModalBody").html('<p class="text-muted mb-0">Caricamento recensioni...</p>');
    bootstrap.Modal.getOrCreateInstance(document.getElementById("reviewsModal")).show(); // mostra modal recensioni

    $.get(`${API_BASE_URL}/sitters/${sitterId}/reviews`, function (response) { // Chiamata api GET /api/sitters/:id/reviews
        if (!response.reviews.length) {
            $("#reviewsModalBody").html('<p class="text-muted mb-0">Nessuna recensione disponibile.</p>');
            return;
        }

        $("#reviewsModalBody").html(response.reviews.map(function (review) { // per ogni review crea questo
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




$(document).ready(function () { // interruttore che fa partire tutto

    // Sezione che prepara i 4 menu a tendina

    // Aspetta che il server abbia finito di scaricare i servizi prima di provare a mostrare i sitter,
    $.when(loadServices()).always(function () { // loadService() usa api GET/api/services che restituisce tutti i servizi esistenti e li salva in allServices. Chiama poi syncFilterOptions() che a sua volta chiama renderPetTypeOptions() e renderServiceOptions() per inserire nel filtro le opzioni per servizi e animali
        if (currentUserIsOwner()) { // se lo user è loggato come proprietario
            loadOwnerPets(); // usa api GET/api/pets (animali del proprietario): se non hai animali restituisce avviso rosso tramite showMissingPetsMessage(), se invece li hai chiama syncOwnerFilterOptions() il quale aggiunge nel filtro come opzioni per animali quelli in suo possesso e i servizi compatibili con l'animale selezionato attraverso i metodi renderOwnerPetOptions() e renderServiceOptions().
            // quando syncOwnerFilterOptions() ha finito loadOwnerPets() chiama loadSitters(filtri)
        } else {
            loadSitters(); // se non è un proprietario esegue loadSitters(). Esegue chiamata api GET /api/sitters che restituisce i sitter disponibili in base ai filtri passati (possono anche non esserci). Dopo aver fatto chiama rendersSitter() che disegna schede a schermo.
        }
    });

    $("#searchForm").on("submit", function (event) {
        event.preventDefault(); // non riaggiornare la pagina

        if (currentUserIsOwner() && !ownerPets.length) { // se sei un proprietario e non hai animali registrati restituisci messaggio errore
            showMissingPetsMessage();
            return;
        }

        loadSitters(currentFilters()); // restituisci sitter
    });

    $("#resetFilters").on("click", function () {
        $("#searchForm")[0].reset(); // svuota tutte le caselle

        if (currentUserIsOwner()) { // se sei un proprietario vengono riaggiunti animali in posesso
            loadOwnerPets();
            return;
        }

        syncFilterOptions(); // se non sei un proprietario chiama syncFilterOptions per ripristinare servizi originali
        loadSitters(); // restituisci sitter
    });



    // quando vengono modificati valori pet, services e rating nel filtro riaggiorna chiamando loadSitters
    $("#petType").on("change", function () {
        syncFilterOptions("pet"); // adatta i servizi del filtro e con renderPetTypeOptions() e renderServiceOptions() ridisegna i menù a tendina
        loadSitters(currentFilters());
    });

    $("#service").on("change", function () {
        syncFilterOptions("service"); // adatta gli animali del filtro
        loadSitters(currentFilters());
    });

    $("#minRating").on("change", function () {
        loadSitters(currentFilters());
    });



    $("#sittersList").on("click", ".sitter-pet-tab", function () { // quando schiaccio su un tab (es. gatto) aggiunge clausola d-none (nascondi) ai servizi di un altro tab (es. cane) e toglie d-none a quelli del gatto. La scheda cambia contenuto senza ricaricare pagina
        const button = $(this);
        const card = button.closest(".sitter-card");
        const petType = button.data("pet-type");

        card.find(".sitter-pet-tab").removeClass("btn-primary").addClass("btn-outline-primary");
        button.removeClass("btn-outline-primary").addClass("btn-primary");
        card.find(".sitter-service-panel").addClass("d-none");
        card.find(`.sitter-service-panel[data-pet-type="${petType}"]`).removeClass("d-none");
    });


    $("#sittersList").on("click", ".book-service", function () { // quando si schiaccia un pulsante prenota si esegue openBookingModal()
        openBookingModal($(this)); // guardare nella dichiarazione
    });

    $("#sittersList").on("click", ".show-reviews", function () {
        showReviews($(this).data("sitter-id"), $(this).data("sitter-name"));
    });



    $("#bookingPet").on("change", checkAvailabilityAndQuote); // Se cambi animale: ricalcola subito il preventivo
    $("#bookingDate").on("change", function () { // Se cambi la data: chiama subito renderHourlyTimes() per aggiornare il menu con gli orari liberi di quel nuovo giorno
        renderHourlyTimes();
    });
    $("#bookingStartTime").on("change", renderEndTimeOptions); // Se cambi l'Ora di Inizio chiama subito renderEndTimeOptions per spostare in automatico anche l'Ora di Fine
    $("#bookingEndTime").on("change", checkAvailabilityAndQuote); // Se cambi orario di fine ricalcola subito il prezzo totale in euro. Al momento non utilizzato poichè possibili prenotazioni di solo un'ora
    $("#bookingStartDateDaily").on("change", renderDailyEndDates); // se cambi la Data di Inizio, ricalcola le Date di Fine consecutive disponibili
    $("#bookingEndDateDaily").on("change", checkAvailabilityAndQuote); // se cambi la Data di Fine, ricalcola il prezzo per i giorni scelti!


    $("#bookingForm").on("submit", function (event) {
        event.preventDefault(); // Non ricaricare la pagina

        const petId = $("#bookingPet").val();
        const startsAt = $("#bookingStart").val();
        const endsAt = $("#bookingEnd").val();

        clearBookingMessage(); // Nasconde vecchi messaggi di errore

        if (!selectedBookingDraft || !petId || !startsAt || !endsAt) {
            showBookingMessage("Completa tutti i dati della prenotazione.");
            return;
        }

        apiRequest("/bookings", { // spedisce tutto al server. Chiamata API: POST /api/bookings
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
            bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingModal")).hide(); // Chiude la finestra di compilazione:

            // Prepara il testo della finestra di conferma
            $("#bookingResultBody").html(`
                <p class="mb-2">La richiesta è stata inviata al sitter.</p>
                <p class="mb-0 text-muted">Potrai pagare dalla dashboard dopo l'accettazione.</p>
            `);

            // Apre a schermo il Modale 2 di successo
            bootstrap.Modal.getOrCreateInstance(document.getElementById("bookingResultModal")).show();

            // Ricarica la lista dei sitter
            loadSitters(currentFilters());
        }).fail(function (xhr) {
            showBookingMessage(xhr.responseJSON?.error || "Errore durante la prenotazione.");
        });
    });
});
