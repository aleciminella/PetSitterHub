const API_BASE_URL = "http://localhost:4000/api";

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
            renderPets(response.pets || []);
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

function savePet(event) {
    event.preventDefault();
    clearPetsMessage();

    $.ajax({
        url: `${API_BASE_URL}/pets`,
        method: "POST",
        headers: authHeaders(),
        contentType: "application/json",
        data: JSON.stringify(getPetFormData()),
        success: function () {
            showPetsMessage("success", "Animale salvato correttamente.");
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

$(document).ready(function () {
    if (!guardOwnerDashboard()) {
        return;
    }

    loadPets();
    $("#refreshPetsButton").on("click", loadPets);
    $("#petForm").on("submit", savePet); 
});