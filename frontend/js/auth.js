$(document).ready(function () {
    $("#registerForm").on("submit", function (event) {
        event.preventDefault();

        const userData = {
            firstName: $("#firstName").val(),
            lastName: $("#lastName").val(),
            email: $("#email").val(),
            password: $("#password").val(),
            role: $("#role").val(),
            city: $("#city").val(),
            phone: $("#phone").val()
        };

        console.log("Dati registrazione:", userData);
    });

    $("#loginForm").on("submit", function (event) {
        event.preventDefault();

        const loginData = {
            email: $("#loginEmail").val(),
            password: $("#loginPassword").val()
        };

        console.log("Dati login:", loginData);
    });
});