const API_BASE_URL = "http://localhost:4000/api";
const PET_TYPES = [
    { value: "cane", label: "Cane" },
    { value: "gatto", label: "Gatto" },
    { value: "uccello", label: "Uccello" },
    { value: "roditore", label: "Roditore" },
    { value: "rettile", label: "Rettile" }
];

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

function loadProfile() {
    $.ajax({
        url: `${API_BASE_URL}/sitters/me`,
        method: "GET",
        headers: authHeaders(),
        success: function (response) {
            const profile = response.profile || {};
            $("#baseCity").val(profile.base_city || profile.city || "");
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
            bio: $("#bio").val()
        }),
        success: function () {
            showMessage("#profileMessage", "success", "Profilo salvato correttamente.");
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
    $("#sitterServicesList").html(services.map(function (service) {
        const checked = service.enabled ? "checked" : "";
        const price = service.price ? Number(service.price).toFixed(2) : "";
        return `
            <article class="sitter-service-row" data-service-id="${service.service_id}" data-pet-type="${service.pet_type}">
                <div class="row align-items-center">
                    <div class="col-lg-5">
                        <div class="form-check">
                            <input class="form-check-input service-enabled-input" type="checkbox" ${checked}>
                            <label class="form-check-label fw-bold">${service.name}</label>
                        </div>
                        <p class="text-muted mb-0">${service.description || ""}</p>
                    </div>
                    <div class="col-lg-3">
                        <span class="service-type">${getPetTypeLabel(service.pet_type)}</span>
                    </div>
                    <div class="col-lg-2">
                        <span class="text-muted">${getPriceUnitLabel(service.price_unit)}</span>
                    </div>
                    <div class="col-lg-2">
                        <input class="form-control service-price-input" type="number" min="0" step="0.01" value="${price}" placeholder="Prezzo">
                    </div>
                </div>
            </article>
        `;
    }).join(""));
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
    $.ajax({
        url: `${API_BASE_URL}/sitters/me/services`,
        method: "PUT",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify({
            services: getSelectedServices()
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

$(document).ready(function () {
    if (!guardSitterDashboard()) {
        return;
    }
    loadProfile();
    loadPetTypes();
    loadServices();
    $("#profileForm").on("submit", saveProfile);
    $("#petTypesForm").on("submit", savePetTypes);
    $("#servicesForm").on("submit", saveServices);
    $("#refreshServicesButton").on("click", loadServices);
});