const API_BASE_URL = "http://localhost:4000/api";

function formatPrice(value) {
    return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value || 0));
}

function getInitials(firstName, lastName) {
    return `${(firstName || "").charAt(0)}${(lastName || "").charAt(0)}`.toUpperCase();
}

function serviceBadges(services) {
    if (!services || services.length === 0) {
        return '<span class="text-muted">Nessun servizio configurato</span>';
    }
    return services.map(function (service) {
        return `
            <span class="service-badge">
                <span>${service.name}</span>
                <strong>${formatPrice(service.price)}</strong>
            </span>
        `;
    }).join("");
}

function renderSitters(sitters) {
    if (!sitters.length) {
        $("#sittersList").html(`
            <div class="col-12">
                <div class="empty-state">Nessun sitter trovato  con i filtri selezionati.</div>
            </div>
        `);
        return;
    }

    $("#sittersList").html(sitters.map(function (sitter) {
        return `
            <div class="col-md-6 col-lg-4">
                <article class="sitter-card h-100">
                    <div class="d-flex gap-3 align-items-start mb-3">
                        <div class="sitter-avatar">${getInitials(sitter.first_name, sitter.last_name)}</div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start gap-2">
                                <div>
                                    <h3 class="h5 mb-1">${sitter.first_name} ${sitter.last_name}</h3>
                                    <p class="text-muted mb-0">${sitter.base_city}</p>
                                </div>
                                ${sitter.verified ? '<span class="badge text-bg-success">Verificato</span>' : ""}
                            </div>
                        </div>
                    </div>
                    <p class="sitter-bio">${sitter.bio || "Bio non disponibile."}</p>
                    <div class="service-list">${serviceBadges(sitter.services)}</div>
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
                <div class="empty-state text-danger">Errore durante il caricamento dei dati.</div>
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
