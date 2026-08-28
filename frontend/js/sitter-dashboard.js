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
        },
        error: function (xhr) {
            const message = xhr.responseJSON && xhr.responseJSON.error
                ? xhr.responseJSON.error
                : "Errore durante il salvataggio degli animali accettati.";
            showMessage("#petTypesMessage", "danger", message);
        }
    });
}

$(document).ready(function () {
    if (!guardSitterDashboard()) {
        return;
    }
    loadProfile();
    loadPetTypes();
    $("#profileForm").on("submit", saveProfile);
    $("#petTypesForm").on("submit", savePetTypes);
});