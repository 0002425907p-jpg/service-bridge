import { auth, signIn, signOut } from "@/auth"
import Link from "next/link"

export default async function Home() {
  const session = await auth()

  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Service &amp; Bridge</h1>
      <p style={{ color: "#555", fontSize: 17, lineHeight: 1.6, marginBottom: 32 }}>
        Pension and investment planning for civil service employees.
      </p>

      {session ? (
        <div>
          <p style={{ marginBottom: 16 }}>Signed in as {session.user?.email}</p>
          <Link
            href="/dashboard"
            style={{ display: "inline-block", padding: "10px 18px", background: "#16213D", color: "#fff", borderRadius: 6, textDecoration: "none", marginRight: 12 }}
          >
            Open dashboard
          </Link>
          <Link
            href="/gig"
            style={{ display: "inline-block", padding: "10px 18px", border: "1px solid #16213D", color: "#16213D", borderRadius: 6, textDecoration: "none", marginRight: 12 }}
          >
            1099 tracker
          </Link>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/" })
            }}
            style={{ display: "inline-block" }}
          >
            <button
              type="submit"
              style={{ padding: "10px 18px", background: "transparent", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/dashboard" })
          }}
        >
          <button
            type="submit"
            style={{ padding: "10px 18px", background: "#16213D", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 15 }}
          >
            Sign in with Google
          </button>
        </form>
      )}
    </main>
  )
}
