/**
 * APIBridge AI — Developer Vocabulary Synonym Dictionary
 * The foundation of semantic understanding
 * Every group = same concept, different names
 */

const SYNONYM_GROUPS = [
  // Identity
  ["id", "identifier", "uid", "uuid", "key", "pk", "primary_key", "record_id"],

  // Person name
  ["first_name", "firstname", "fname", "given_name", "forename", "first"],
  ["last_name", "lastname", "lname", "surname", "family_name", "last"],
  ["full_name", "fullname", "name", "display_name", "displayname"],
  ["middle_name", "middlename", "mname", "middle"],
  ["username", "user_name", "uname", "login", "handle", "screen_name"],
  ["nickname", "nick", "alias", "preferred_name"],

  // Contact
  ["email", "email_address", "emailaddress", "mail", "e_mail"],
  ["phone", "phone_number", "phonenumber", "mobile", "mobile_number",
   "cell", "cell_number", "contact_number", "tel", "telephone"],
  ["address", "addr", "location", "place", "residence"],
  ["street", "street_address", "addr_line1", "address_line1",
   "address_line_1", "line1", "addr1"],
  ["city", "town", "addr_city", "address_city", "locality"],
  ["state", "province", "region", "addr_state"],
  ["country", "nation", "addr_country", "country_name"],
  ["zip", "zipcode", "zip_code", "pincode", "pin_code",
   "postal_code", "postcode", "post_code"],

  // Auth
  ["password", "pwd", "pw", "pass", "passwd", "secret"],
  ["token", "access_token", "auth_token", "jwt", "bearer"],
  ["refresh_token", "refreshtoken", "refresh"],
  ["otp", "one_time_password", "verification_code", "code", "pin"],
  ["role", "user_role", "access_level", "permission_level"],

  // Status / Boolean
  ["is_active", "isactive", "active", "enabled", "status",
   "is_enabled", "activated"],
  ["is_deleted", "isdeleted", "deleted", "removed", "is_removed"],
  ["is_verified", "isverified", "verified", "confirmed", "is_confirmed"],
  ["is_admin", "isadmin", "admin", "is_superuser", "superuser"],
  ["is_blocked", "isblocked", "blocked", "banned", "is_banned"],
  ["is_premium", "ispremium", "premium", "is_pro", "pro", "subscribed"],

  // Dates
  ["created_at", "createdat", "created", "creation_date",
   "date_created", "insert_date", "added_at"],
  ["updated_at", "updatedat", "updated", "modified_at",
   "last_modified", "date_modified", "last_updated"],
  ["deleted_at", "deletedat", "removed_at", "date_deleted"],
  ["dob", "date_of_birth", "dateofbirth", "birth_date",
   "birthdate", "birthday", "birth_day"],
  ["expires_at", "expiresat", "expiry", "expiry_date",
   "expiration", "expiration_date", "valid_until"],
  ["published_at", "publishedat", "published_date", "release_date"],
  ["joined_at", "joinedat", "registered_at", "signup_date", "enrollment_date"],

  // Media
  ["image", "img", "photo", "picture", "pic",
   "avatar", "thumbnail", "profile_image", "profile_pic"],
  ["video", "vid", "clip", "media"],
  ["file", "attachment", "document", "doc", "upload"],
  ["url", "link", "href", "src", "path", "uri", "endpoint"],

  // Pricing
  ["price", "cost", "amount", "fee", "charge", "rate", "value"],
  ["discount", "discount_amount", "offer", "reduction", "savings"],
  ["tax", "tax_amount", "gst", "vat", "duty"],
  ["total", "total_amount", "grand_total", "final_amount", "net_amount"],
  ["currency", "currency_code", "curr"],
  ["quantity", "qty", "count", "num", "number", "units"],

  // Description
  ["description", "desc", "details", "info", "about", "summary", "overview"],
  ["title", "heading", "label", "caption", "subject", "name"],
  ["content", "body", "text", "message", "data"],
  ["notes", "note", "comment", "remarks", "remark", "feedback"],
  ["tags", "tag", "keywords", "categories", "labels"],

  // User
  ["user", "usr", "member", "account", "profile", "person"],
  ["user_id", "userid", "uid", "member_id", "account_id", "profile_id"],
  ["owner", "owner_id", "created_by", "author", "author_id", "user_ref"],

  // Relations
  ["parent", "parent_id", "parentid"],
  ["children", "child", "kids", "sub_items", "nested"],
  ["category", "cat", "type", "group", "kind", "class"],
  ["category_id", "cat_id", "type_id", "group_id"],

  // Pagination
  ["page", "page_number", "pg", "current_page"],
  ["limit", "per_page", "page_size", "size", "rows"],
  ["total", "total_count", "total_records", "total_items", "record_count"],
  ["offset", "skip", "start"],

  // Response meta
  ["success", "ok", "status", "result", "is_success"],
  ["error", "err", "message", "error_message", "msg", "reason"],
  ["data", "result", "payload", "response", "body", "items", "records"],

  // Timestamps
  ["timestamp", "time", "datetime", "date_time"],
  ["start_date", "startdate", "start", "from", "from_date", "begin"],
  ["end_date", "enddate", "end", "to", "to_date", "until"],

  // Location / Map
  ["latitude", "lat", "y_coord"],
  ["longitude", "lng", "lon", "long", "x_coord"],
  ["coordinates", "coords", "geo", "location"],

  // Business
  ["company", "organisation", "organization", "org", "business", "firm"],
  ["order", "order_id", "booking", "booking_id", "transaction"],
  ["invoice", "bill", "receipt"],
  ["product", "item", "goods", "listing"],
  ["customer", "client", "buyer", "purchaser"],
];

// Build flat lookup map: word → group index
const WORD_TO_GROUP = new Map();
SYNONYM_GROUPS.forEach((group, idx) => {
  group.forEach(word => {
    WORD_TO_GROUP.set(word.toLowerCase(), idx);
  });
});

module.exports = { SYNONYM_GROUPS, WORD_TO_GROUP };
