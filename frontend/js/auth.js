const API_BASE_URL = "http://localhost:3000/api";

function showMessage(type, text) {
    $("#authMessage")
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function saveUser(user) {
    localStorage.setItem("petsitterhubUser", JSON.stringify(user));
}

function redirectToHome() {
    setTimeout(function () {
        window.location.href = "../index.html";
    }, 800);
}

function setFormLoading(form, isLoading) {
    const button = form.find("button[type='submit']");
    const defaultText = button.data("default-text");
    button.prop("disabled", isLoading);
    button.text(isLoading ? "Attendere..." : defaultText);
}

$(document).ready(function () {
    $("button[type='submit']").each(function () {
        $(this).data("default-text", $(this).text());
    });

    $("#registerForm").on("submit", function (event) {
        event.preventDefault();

        const form = $(this);
        setFormLoading(form, true);

        const userData = {
            firstName: $("#firstName").val(),
            lastName: $("#lastName").val(),
            email: $("#email").val(),
            password: $("#password").val(),
            role: $("#role").val(),
            city: $("#city").val(),
            phone: $("#phone").val()
        };

        $.ajax({
            url: `${API_BASE_URL}/auth/register`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(userData),
            success: function (response) {
                saveUser(response.user);
                showMessage("success", "Registrazione completata.");
                redirectToHome();
            },
            error: function (xhr) {
                const message = xhr.responseJSON?.error || "Errore durante la registrazione.";
                showMessage("danger", message);
            },
            complete: function () {
                setFormLoading(form, false);
            }
        });
    });

    $("#loginForm").on("submit", function (event) {
        event.preventDefault();

        const form = $(this);
        setFormLoading(form, true);

        const loginData = {
            email: $("#loginEmail").val(),
            password: $("#loginPassword").val()
        };

        $.ajax({
            url: `${API_BASE_URL}/auth/login`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(loginData),
            success: function (response) {
                saveUser(response.user);
                showMessage("success", "Login effettuato.");
                redirectToHome();
            },
            error: function (xhr) {
                const message = xhr.responseJSON?.error || "Errore durante il login.";
                showMessage("danger", message);
            },
            complete: function () {
                setFormLoading(form, false);
            }
        });
    });
});