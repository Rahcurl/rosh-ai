import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClerk, UserButton, useUser } from "@clerk/clerk-react";

const Navbar = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { openSignIn } = useClerk();

  return (
    <div className="fixed z-50 w-full backdrop-blur-2xl flex justify-between items-center py-3 px-4 sm:px-20 xl:px-32"
      style={{ borderBottom: "0.5px solid rgba(180,160,220,0.18)" }}>

      {/* Logo */}
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => navigate("/")}
      >
        <span
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.7px",
            lineHeight: 1,
            background: "linear-gradient(110deg, #1E1065 0%, #4F46E5 45%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Rosh
        </span>

        <span
          style={{
            fontSize: "20px",
            fontWeight: 300,
            lineHeight: 1,
            color: "#C4B5FD",
            WebkitTextFillColor: "#C4B5FD",
          }}
        >
          -
        </span>

        <span
          style={{
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.4px",
            lineHeight: 1,
            background: "linear-gradient(110deg, #7C3AED 0%, #A78BFA 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AI
        </span>
      </div>

      {/* Auth */}
      {user ? (
        <UserButton />
      ) : (
        <button
          onClick={openSignIn}
          className="flex items-center gap-2 rounded-full text-sm cursor-pointer text-white px-8 py-2.5"
          style={{ background: "#4F46E5" }}
        >
          Get started <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Navbar;