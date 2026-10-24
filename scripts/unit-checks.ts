import assert from "node:assert/strict";
import { sanitizeCell, toCsv } from "../src/lib/csv";
import { finalistSchema } from "../src/lib/finalist-schema";
import { internalHref, linkedinHref } from "../src/lib/links";
import { listingSchema } from "../src/lib/matching-schema";
import { gmailBatches, gmailComposeUrl, personalize, whatsappUrl } from "../src/lib/contact";
import { profileSchema, registerSchema, safeNext, teamSchema } from "../src/lib/validation";

// CSV formula injection
for (const evil of ["=1+1", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\tx", "\rx"]) {
  assert.ok(sanitizeCell(evil).startsWith("'"), `not neutralised: ${JSON.stringify(evil)}`);
}
assert.equal(sanitizeCell("+919876543210"), "+919876543210");
assert.equal(sanitizeCell("Alice"), "Alice");
assert.ok(toCsv(["a"], [['he said "hi", ok']]).includes('"he said ""hi"", ok"'));

// Validation
const ok = profileSchema.safeParse({
  fullName: "  Ali   Zubair ", mobileNumber: "98765 43210", gmail: " Ali@Gmail.com ",
  githubUsername: "https://github.com/octocat/", linkedinUrl: "linkedin.com/in/ali-zubair",
});
assert.ok(ok.success);
assert.deepEqual(ok.data, { fullName: "Ali Zubair", mobileNumber: "+919876543210", gmail: "ali@gmail.com",
  githubUsername: "octocat", linkedinUrl: "https://www.linkedin.com/in/ali-zubair" });
for (const bad of [
  { mobileNumber: "12345" }, { gmail: "a@yahoo.com" }, { githubUsername: "-bad" },
  { githubUsername: "a--b" }, { linkedinUrl: "https://evil.com/in/x" }, { linkedinUrl: "javascript:alert(1)" },
]) assert.ok(!profileSchema.safeParse({ ...ok.data, ...bad }).success, JSON.stringify(bad));

assert.ok(registerSchema.safeParse({ username: "Alice_1", password: "password1", confirmPassword: "password1" }).success);
assert.ok(!registerSchema.safeParse({ username: "admin", password: "password1", confirmPassword: "password1" }).success);
assert.ok(!registerSchema.safeParse({ username: "a b", password: "password1", confirmPassword: "password1" }).success);
assert.ok(!registerSchema.safeParse({ username: "alice", password: "password1", confirmPassword: "nope" }).success);
assert.ok(!teamSchema.safeParse({ name: "<script>", description: "long enough description" }).success);

// Open redirect protection
assert.equal(safeNext("//evil.com"), "/dashboard");
assert.equal(safeNext("https://evil.com"), "/dashboard");
assert.equal(safeNext("/\\evil.com"), "/dashboard");
assert.equal(safeNext("/join/abc"), "/join/abc");
// WhatsApp / Gmail links
assert.equal(whatsappUrl("+919876543210"), "https://wa.me/919876543210");
assert.equal(whatsappUrl("+919876543210", "Hi & bye"), "https://wa.me/919876543210?text=Hi%20%26%20bye");
assert.equal(whatsappUrl("12345"), null);
assert.equal(whatsappUrl(null), null);
assert.ok(gmailComposeUrl({ to: ["a@gmail.com"] }).startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=a%40gmail.com"));
const manyEmails = Array.from({ length: 500 }, (_, i) => `user${i}@gmail.com`);
const batched = gmailBatches(manyEmails, { subject: "Hi", body: "x".repeat(200) });
assert.ok(batched.length > 1);
assert.equal(batched.flatMap((b) => b.emails).length, 500);
assert.ok(batched.every((b) => b.url.length <= 6000));
assert.ok(batched.every((b) => b.url.includes("bcc=") && !b.url.includes("&to=")));
assert.equal(personalize("Hi {name}!", "Ali Zubair Shah"), "Hi Ali!");
assert.equal(personalize("Hi {name}!", null), "Hi there!");
// Finalist input
assert.deepEqual(finalistSchema.parse({ finalist: true, award: "  Winner ", rank: "1" }), { finalist: true, award: "Winner", rank: 1 });
assert.deepEqual(finalistSchema.parse({ finalist: true, award: "", rank: "" }), { finalist: true, award: null, rank: null });
assert.deepEqual(finalistSchema.parse({ finalist: false, award: "Winner", rank: 2 }), { finalist: false, award: null, rank: null });
for (const bad of [{ award: "x" }, { award: "", rank: 3 }, { award: "Winner", rank: 0 }, { award: "Winner", rank: 100 }, { award: "a".repeat(61) }])
  assert.ok(!finalistSchema.safeParse({ finalist: true, rank: null, ...bad }).success, JSON.stringify(bad));
// Looking-for-a-team listing
const listing = listingSchema.parse({ skills: " React,  Python ,, Figma ", interests: "AI", intro: "  Hi  ", preferredRole: "", portfolioUrl: "" });
assert.deepEqual(listing.skills, ["React", "Python", "Figma"]);
assert.equal(listing.intro, "Hi");
for (const bad of [
  { skills: "" }, { skills: "a,b,c,d,e,f,g,h,i,j,k" }, { skills: "x".repeat(31) },
  { intro: "x".repeat(301) }, { preferredRole: "x" }, { portfolioUrl: "http://insecure.example" },
  { portfolioUrl: "javascript:alert(1)" }, { portfolioUrl: "https://" },
]) assert.ok(!listingSchema.safeParse({ skills: "React", interests: "", intro: "", preferredRole: "", portfolioUrl: "", ...bad }).success, JSON.stringify(bad));
assert.ok(listingSchema.safeParse({ skills: "React", interests: "", intro: "", preferredRole: "Frontend", portfolioUrl: "https://example.com/me" }).success);
// Contact / notification links only ever become clickable when they are well-formed
assert.equal(linkedinHref("https://www.linkedin.com/in/ali-zubair"), "https://www.linkedin.com/in/ali-zubair");
assert.equal(linkedinHref("https://www.linkedin.com/in/ali-zubair/"), "https://www.linkedin.com/in/ali-zubair/");
for (const bad of [null, undefined, "", "javascript:alert(1)", "https://evil.com/in/ali-zubair",
  "http://www.linkedin.com/in/ali-zubair", "https://www.linkedin.com/in/ab", "https://www.linkedin.com.evil.com/in/ali",
  "https://www.linkedin.com/in/ali zubair", "https://www.linkedin.com/in/ali\"onmouseover=\"x"])
  assert.equal(linkedinHref(bad), null, String(bad));
assert.equal(internalHref("/teams/requests"), "/teams/requests");
assert.equal(internalHref("/team/0f8fad5b-d9cb-469f-a165-70867728950e"), "/team/0f8fad5b-d9cb-469f-a165-70867728950e");
assert.equal(internalHref("/dashboard"), "/dashboard");
for (const bad of [null, undefined, "", "/", "//evil.com", "https://evil.com", "javascript:alert(1)", "/a//b", "/a b", "/a?x=1", "teams"])
  assert.equal(internalHref(bad), null, String(bad));
console.log("UNIT CHECKS PASSED");
