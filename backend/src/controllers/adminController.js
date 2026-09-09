const pool = require("../db/pool");

function getPagination(query) {
  const limit = Math.min(Number(query.limit) || 5, 30);
  const offset = Number(query.offset) || 0;

  return {
    limit: Math.max(limit, 1),
    offset: Math.max(offset, 0)
  };
}

function getUserOrder(sort) {
  const orders = {
    role: "u.role asc, u.first_name asc, u.last_name asc",
    name: "u.first_name asc, u.last_name asc",
    city: "u.city asc nulls last, u.first_name asc, u.last_name asc",
    created_at: "u.created_at desc"
  };

  return orders[sort] || orders.created_at;
}

async function getOverview(req, res, next) {
  try {
    const result = await pool.query(
      `select
         (select count(*)::integer from users where is_active = true) as total_users,
         (select count(*)::integer from users where role = 'owner' and is_active = true) as total_owners,
         (select count(*)::integer from users where role = 'sitter' and is_active = true) as total_sitters,
         (select count(*)::integer from users where role = 'admin' and is_active = true) as total_admins,
         (select count(*)::integer from bookings) as total_bookings,
         (select count(*)::integer from bookings where status = 'pending') as pending_bookings,
         (select count(*)::integer from bookings where status = 'accepted') as accepted_bookings,
         (select count(*)::integer from bookings where status = 'completed') as completed_bookings,
         (select count(*)::integer from reviews) as total_reviews`
    );

    return res.json({
      overview: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const pagination = getPagination(req.query);
    const values = [];
    const conditions = ["u.is_active = true"];

    if (req.query.search) {
      values.push(`%${req.query.search}%`);
      conditions.push(`(
        u.email ilike $${values.length}
        or u.first_name ilike $${values.length}
        or u.last_name ilike $${values.length}
        or u.city ilike $${values.length}
      )`);
    }

    values.push(pagination.limit, pagination.offset);

    const whereClause = conditions.length ? `where ${conditions.join(" and ")}` : "";

    const result = await pool.query(
      `select
         u.id,
         u.email,
         u.first_name,
         u.last_name,
         u.role,
         u.phone,
         u.city,
         u.created_at,
         sp.id as sitter_profile_id,
         sp.verified as sitter_verified
       from users u
       left join sitter_profiles sp on sp.user_id = u.id
       ${whereClause}
       order by ${getUserOrder(req.query.sort)}
       limit $${values.length - 1}
       offset $${values.length}`,
      values
    );

    return res.json({
      users: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function listBookings(req, res, next) {
  try {
    const pagination = getPagination(req.query);
    const result = await pool.query(
      `select
         b.id,
         b.starts_at,
         b.ends_at,
         b.status,
         b.total_price,
         b.created_at,
         owner.first_name as owner_first_name,
         owner.last_name as owner_last_name,
         sitter_user.first_name as sitter_first_name,
         sitter_user.last_name as sitter_last_name,
         p.name as pet_name,
         p.species as pet_type,
         s.name as service_name
       from bookings b
       join users owner on owner.id = b.owner_id
       join sitter_profiles sp on sp.id = b.sitter_id
       join users sitter_user on sitter_user.id = sp.user_id
       join pets p on p.id = b.pet_id
       join services s on s.id = b.service_id
       order by b.created_at desc
       limit $1
       offset $2`,
      [pagination.limit, pagination.offset]
    );

    return res.json({
      bookings: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function listReviews(req, res, next) {
  try {
    const pagination = getPagination(req.query);
    const result = await pool.query(
      `select
         r.id,
         r.rating,
         r.comment,
         r.created_at,
         owner.first_name as owner_first_name,
         owner.last_name as owner_last_name,
         sitter_user.first_name as sitter_first_name,
         sitter_user.last_name as sitter_last_name,
         s.name as service_name
       from reviews r
       join users owner on owner.id = r.owner_id
       join sitter_profiles sp on sp.id = r.sitter_id
       join users sitter_user on sitter_user.id = sp.user_id
       join bookings b on b.id = r.booking_id
       join services s on s.id = b.service_id
       order by r.created_at desc
       limit $1
       offset $2`,
      [pagination.limit, pagination.offset]
    );

    return res.json({
      reviews: result.rows
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteUser(req, res, next) {
  const client = await pool.connect();

  try {
    if (Number(req.params.id) === Number(req.user.id)) { // impedisce di cancellare account admin proprio
      return res.status(400).json({
        error: "Non puoi eliminare il tuo account admin"
      });
    }

    await client.query("begin"); // Da questo momento in poi, esegui tutte le query successive come un unico blocco atomico


    // Seleziona l'utente e "blocca" la riga (for update) sul DB per evitare che un'altra richiesta contemporanea la modifichi.
    const userResult = await client.query(
      `select id, role
       from users
       where id = $1
         and is_active = true
       for update`,
      [req.params.id]
    );

    // Se l'utente non esiste o è già inattivo (is_active = false), esegue il ROLLBACK e restituisce 404.
    if (userResult.rows.length === 0) {
      await client.query("rollback");
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    const targetUser = userResult.rows[0];


    // Cerca tutte le prenotazioni in corso o future (pending o accepted) legate all'utente da eliminare
    const bookingsResult = await client.query(
      `select
         b.id,
         b.owner_id,
         sp.user_id as sitter_user_id,
         case
           when b.owner_id = $1 then sp.user_id
           else b.owner_id
         end as counterpart_user_id
       from bookings b
       join sitter_profiles sp on sp.id = b.sitter_id
       where (b.owner_id = $1 or sp.user_id = $1)
         and b.status in ('pending', 'accepted')
         and b.ends_at >= now()
       for update of b`,
      [req.params.id]
    );

    const bookingIds = bookingsResult.rows.map((booking) => booking.id);
    let refundedBookingIds = [];


    if (bookingIds.length > 0) {
      await client.query( // Imposta lo stato delle prenotazioni su 'cancelled'
        `update bookings
         set status = 'cancelled', updated_at = now()
         where id = any($1::bigint[])`,
        [bookingIds]
      );

      const refundResult = await client.query( // Aggiorna lo stato dei pagamenti da 'paid' o 'authorized' a 'refunded'
        `update payments
         set status = 'refunded'
         where booking_id = any($1::bigint[])
           and status in ('authorized', 'paid')
         returning booking_id`,
        [bookingIds]
      );
      refundedBookingIds = refundResult.rows.map((payment) => String(payment.booking_id)); // Mantiene traccia di quali prenotazioni sono state rimborsate
    }

    // Invece di cancellare fisicamente la riga dal database, disattiva l'account impostando is_active = false e registra la data in deleted_at.
    await client.query(
      `update users
       set is_active = false,
           deleted_at = now()
       where id = $1`,
      [req.params.id]
    );

    // Cicla sulle prenotazioni annullate per avvisare la controparte
    for (const booking of bookingsResult.rows) {
      const refundText = refundedBookingIds.includes(String(booking.id))
        ? " È stato avviato il rimborso sul metodo di pagamento utilizzato."
        : ""; // Aggiunge il messaggio del rimborso solo se la prenotazione rientrava tra quelle con pagamento rimborsato
      const removedRole = targetUser.role === "sitter" ? "sitter" : "proprietario";

      await client.query(
        `insert into notifications (user_id, booking_id, type, title, body)
         select $1, $2, 'booking_cancelled', 'Prenotazione annullata', $3
         where exists (
           select 1
           from users
           where id = $1
             and is_active = true
         )`,
        [
          booking.counterpart_user_id,
          booking.id,
          `La prenotazione è stata annullata perché l'account del ${removedRole} è stato eliminato dall'amministrazione.${refundText}`
        ]
      );
    }

    await client.query("commit");
    return res.sendStatus(204);
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
  }
}

async function promoteUserToAdmin(req, res, next) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const userResult = await client.query(
      `select id
       from users
       where id = $1
         and is_active = true
       for update`,
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      await client.query("rollback");
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    const activeBookingsResult = await client.query(
      `select exists (
         select 1
         from bookings b
         join sitter_profiles sp on sp.id = b.sitter_id
         where (b.owner_id = $1 or sp.user_id = $1)
           and (
             b.status = 'pending'
             or (b.status = 'accepted' and b.ends_at >= now())
           )
       ) as has_active_bookings`,
      [req.params.id]
    );

    if (activeBookingsResult.rows[0].has_active_bookings) {
      await client.query("rollback");
      return res.status(409).json({
        error: "Non è possibile promuovere questo utente: sono presenti prenotazioni ancora attive"
      });
    }

    const result = await client.query(
      `update users
       set role = 'admin'
       where id = $1
       returning id, email, first_name, last_name, role, phone, city, created_at`,
      [req.params.id]
    );

    await client.query("commit");

    return res.json({
      user: result.rows[0]
    });
  } catch (err) {
    await client.query("rollback");
    return next(err);
  } finally {
    client.release();
  }
}

async function updateSitterVerification(req, res, next) {
  try {
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({
        error: "Stato verifica non valido"
      });
    }

    const result = await pool.query(
      `update sitter_profiles sp
       set verified = $1
       from users u
       where sp.id = $2
         and u.id = sp.user_id
         and u.is_active = true
       returning sp.id, sp.user_id, sp.bio, sp.base_city, sp.verified, sp.created_at`,
      [verified, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Profilo sitter non trovato"
      });
    }

    return res.json({
      sitter: result.rows[0]
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  deleteUser,
  getOverview,
  listBookings,
  listReviews,
  listUsers,
  promoteUserToAdmin,
  updateSitterVerification
};
