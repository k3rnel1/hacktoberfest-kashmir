import assert from "node:assert/strict";
import { sanitizeCell, toCsv } from "../src/lib/csv";
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
console.log("UNIT CHECKS PASSED");
