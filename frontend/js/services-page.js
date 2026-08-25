const API_BASE_URL = "http://localhost:4000/api";

function servicePriceLabel(service) {
    if (service.price_unit === "hourly") {
        return "Tariffa oraria";
    }
    if (service.price_unit === "daily") {
        return "Tariffa giornaliera";
    }
    if (service.price_unit === "fixed") {
        return "Prezzo fisso";
    }
    return "Tariffa configurabile";
}

function renderServices(services) {
    if (!services.length) {
        $("#servicesList").html(`
            <div class="col-12">
                <div class="empty-state">Nessun servizio disponibile.</div>
            </div>
        `);
        return;
    }

    $("#servicesList").html(services.map(function (service) {
        return `
            <div class="col-md-6 col-lg-4">
                <article class="service-card h-100">
                    <span class="service-type">${servicePriceLabel(service)}</span>
                    <h2 class="h5 mt-3">${service.name}</h2>
                    <p class="text-muted mb-0">${service.description || "Descrizione non disponibile."}</p>
                </article>
            </div>
        `;
    }).join(""));
}

$(document).ready(function () {
    $("#servicesList").html(`
        <div class="col-12">
            <div class="empty-state">Caricamento servizi...</div>
        </div>
    `);

    $.get(`${API_BASE_URL}/services`, function (response) {
        renderServices(response.services || []);
    }).fail(function () {
        $("#servicesList").html(`
            <div class="col-12">
                <div class="empty-state text-danger">Errore durante il caricamento dei servizi.</div>
            </div>
        `);
    });
});