const API_BASE_URL = "http://localhost:4000/api";

function showMessage(type, text) {
    $("#authMessage")
        .removeClass("d-none alert-success alert-danger")
        .addClass(`alert-${type}`)
        .text(text);
}

function saveSession(response) { // salva la sessione, mette user e token in localStorage
    localStorage.setItem("petsitterhubUser", JSON.stringify(response.user));
    localStorage.setItem("petsitterhubToken", response.token);
}

function redirectToHome() {
    setTimeout(function () {
        window.location.href = "../index.html";
    }, 800);
}

function setFormLoading(form, isLoading) { // Mentre il server sta elaborando la password, disattiva il pulsante e ci scrive sopra: "Attendere...".  Serve per evitare che un utente impaziente clicchi "Registrati" 5 volte di fila
    const button = form.find("button[type='submit']");
    const defaultText = button.data("default-text");
    button.prop("disabled", isLoading);
    button.text(isLoading ? "Attendere..." : defaultText);
}

$(document).ready(function () {
    $("button[type='submit']").each(function () { // serve a memorizzare la scritta originale del pulsante prima di cambiarla in "Attendere...".
        $(this).data("default-text", $(this).text());
    });

    $(".toggle-password-button").on("click", function () { // occhio che mostra nasconde password
        const target = $($(this).data("target"));
        const isPassword = target.attr("type") === "password";
        target.attr("type", isPassword ? "text" : "password");
        $(this).attr("aria-label", isPassword ? "Nascondi password" : "Mostra password");
    });

    $("#registerForm").on("submit", function (event) { // registrazione
        event.preventDefault(); // blocca ricaricamento pagina

        const form = $(this);
        setFormLoading(form, true); // Il pulsante diventa "Attendere..."

        const userData = { // Raccoglie i dati
            firstName: $("#firstName").val(),
            lastName: $("#lastName").val(),
            email: $("#email").val(),
            password: $("#password").val(),
            role: $("#role").val(),
            city: $("#city").val()
        };

        $.ajax({ // manda la chiamata al backend
            url: `${API_BASE_URL}/auth/register`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(userData),
            success: function (response) {
                saveSession(response);
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

    $("#loginForm").on("submit", function (event) { // login
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
                saveSession(response);
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
