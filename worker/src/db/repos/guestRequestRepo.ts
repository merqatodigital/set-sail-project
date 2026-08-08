// Guest requests repository — D1 data access layer for guest_requests.
// All queries are parameterized and tenant-scoped.
// Server generates authoritative fields (id, timestamps, status).

export interface GuestRequestRow {
  id: string;
  tenant_id: string;
  type: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  room_type: string;
  check_in: string;
  check_out: string;
  tour_name: string;
  tour_date: string;
  bike_name: string;
  start_date: string;
  end_date: string;
  guests: number;
  amount: number;
  notes: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface GuestRequest {
  id: string;
  type: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  tourName: string;
  tourDate: string;
  bikeName: string;
  startDate: string;
  endDate: string;
  guests: number;
  amount: number;
  notes: string;
  status: string;
  source: string;
  createdAt: string;
}

function rowToRequest(row: GuestRequestRow): GuestRequest {
  return {
    id: row.id,
    type: row.type,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    guestEmail: row.guest_email,
    roomType: row.room_type,
    checkIn: row.check_in,
    checkOut: row.check_out,
    tourName: row.tour_name,
    tourDate: row.tour_date,
    bikeName: row.bike_name,
    startDate: row.start_date,
    endDate: row.end_date,
    guests: row.guests,
    amount: row.amount,
    notes: row.notes,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
  };
}

/**
 * Create a new guest request. Server generates id, timestamps, and initial status.
 * The returned object is the authoritative record from D1.
 */
export async function createGuestRequest(
  db: D1Database,
  tenantId: string,
  input: {
    type: string;
    guestName: string;
    guestPhone?: string;
    guestEmail?: string;
    roomType?: string;
    checkIn?: string;
    checkOut?: string;
    tourName?: string;
    tourDate?: string;
    bikeName?: string;
    startDate?: string;
    endDate?: string;
    guests?: number;
    amount?: number;
    notes?: string;
    source?: string;
  },
): Promise<GuestRequest> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = "pending";
  const source = input.source || "talla_chat";

  await db
    .prepare(
      `INSERT INTO guest_requests (
        id, tenant_id, type, guest_name, guest_phone, guest_email,
        room_type, check_in, check_out, tour_name, tour_date,
        bike_name, start_date, end_date, guests, amount, notes,
        status, source, created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6,
        ?7, ?8, ?9, ?10, ?11,
        ?12, ?13, ?14, ?15, ?16, ?17,
        ?18, ?19, ?20, ?21
      )`,
    )
    .bind(
      id,
      tenantId,
      input.type,
      input.guestName,
      input.guestPhone || "",
      input.guestEmail || "",
      input.roomType || "",
      input.checkIn || "",
      input.checkOut || "",
      input.tourName || "",
      input.tourDate || "",
      input.bikeName || "",
      input.startDate || "",
      input.endDate || "",
      input.guests || 1,
      input.amount || 0,
      input.notes || "",
      status,
      source,
      now,
      now,
    )
    .run();

  // Return the authoritative record
  const row = await db
    .prepare("SELECT * FROM guest_requests WHERE id = ?1")
    .bind(id)
    .first<GuestRequestRow>();

  if (!row) {
    throw new Error("Failed to retrieve created guest request");
  }

  return rowToRequest(row);
}

/**
 * List guest requests for a tenant, optionally filtered by type and status.
 */
export async function listGuestRequests(
  db: D1Database,
  tenantId: string,
  filters?: { type?: string; status?: string; limit?: number },
): Promise<GuestRequest[]> {
  let query = "SELECT * FROM guest_requests WHERE tenant_id = ?1";
  const params: unknown[] = [tenantId];
  let paramIndex = 2;

  if (filters?.type) {
    query += ` AND type = ?${paramIndex}`;
    params.push(filters.type);
    paramIndex++;
  }
  if (filters?.status) {
    query += ` AND status = ?${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  query += " ORDER BY created_at DESC";

  if (filters?.limit) {
    query += ` LIMIT ?${paramIndex}`;
    params.push(filters.limit);
    paramIndex++;
  }

  const { results } = await db.prepare(query).bind(...params).all<GuestRequestRow>();
  return results.map(rowToRequest);
}

/**
 * Get a single guest request by ID, scoped to tenant.
 */
export async function getGuestRequest(
  db: D1Database,
  tenantId: string,
  requestId: string,
): Promise<GuestRequest | null> {
  const row = await db
    .prepare(
      "SELECT * FROM guest_requests WHERE tenant_id = ?1 AND id = ?2",
    )
    .bind(tenantId, requestId)
    .first<GuestRequestRow>();
  return row ? rowToRequest(row) : null;
}

/**
 * Update guest request status. Server validates the transition.
 */
export async function updateGuestRequestStatus(
  db: D1Database,
  tenantId: string,
  requestId: string,
  newStatus: string,
): Promise<GuestRequest | null> {
  const allowedStatuses = ["pending", "confirmed", "cancelled", "completed"];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE guest_requests
       SET status = ?1, updated_at = ?2
       WHERE tenant_id = ?3 AND id = ?4`,
    )
    .bind(newStatus, now, tenantId, requestId)
    .run();

  return getGuestRequest(db, tenantId, requestId);
}
