const API_BASE_URL = "/api";

function formatPrice(value) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function serviceBadges(services) {
    if (!services || services.length === 0) {
        return '<span class="text-muted">Nessun servizio configurato</span>';
    }
    return services.map(function (service) {
        return `<span class="service-badge">${service.name} - ${formatPrice(service.price)}</span>`;
    }).join("");
}

function renderSitters(sitters) {
    if (!sitters.length) {
        $("#sittersList").html(`
            <div class="col-12">
                <div class="empty-state">Nessun sitter trovato.</div>
            </div>
        `);
        return;
    }

    $("#sittersList").html(sitters.map(function (sitter) {
        return `
            <div class="col-md-6 col-lg-4">
                <article class="sitter-card">
                    <div class="d-flex justify-content-between align-items-start gap-2">
                        <div>
                            <h3 class="h5">${sitter.first_name} ${sitter.last_name}</h3>
                            <p class="text-muted mb-2">${sitter.base_city}</p>
                        </div>
                        ${sitter.verified ? '<span class="badge text-bg-success">Verificato</span>' : ""}
                    </div>
                    <p>${sitter.bio || "Bio non disponibile."}</p>
                    <div>${serviceBadges(sitter.services)}</div>
                </article>
            </div>
        `;
    }).join(""));
}

function loadServices() {
    $.get(`${API_BASE_URL}/services`, function (response) {
        const options = response.services.map(function (service) {
            return `<option value="${service.name}">${service.name}</option>`;
        });
        $("#service").append(options.join(""));
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

$(document).ready(function () {
    loadServices();
    loadSitters();

    $("#searchForm").on("submit", function (event) {
        event.preventDefault();
        loadSitters({
            city: $("#city").val(),
            service: $("#service").val()
        });
    });

    $("#resetFilters").on("click", function () {
        $("#searchForm")[0].reset();
        loadSitters();
    });
});