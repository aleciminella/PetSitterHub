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

$(document).ready(function () {
    if (!guardSitterDashboard()) {
        return;
    }
    loadProfile();
    $("#profileForm").on("submit", saveProfile);
});