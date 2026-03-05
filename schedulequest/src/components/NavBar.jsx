import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/AppStore";
import { xpToNextLevel } from "../lib/game";

export default function NavBar() {
  const { activeUser, userState, logout } = useAppStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/auth");
  }

  if (!activeUser || !userState) {
    return null;
  }

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <Link to="/today" className="brand">ScheduleQuest</Link>
        <p className="brand-sub">{activeUser}</p>
      </div>

      <nav className="tabs" aria-label="Main navigation">
        <NavLink to="/today">Today</NavLink>
        <NavLink to="/tasks">Tasks</NavLink>
        <NavLink to="/rewards">Rewards</NavLink>
        <NavLink to="/stats">Stats</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>

      <div className="wallet">
        <p>Lvl {userState.stats.level}</p>
        <p>{userState.stats.xp}/{xpToNextLevel(userState.stats.level)} XP</p>
        <p>{userState.stats.coins} coins</p>
        <button type="button" onClick={handleLogout}>Logout</button>
      </div>
    </header>
  );
}
