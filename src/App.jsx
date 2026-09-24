import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  getCurrentSession,
  loadPlayerAccount,
  observeAuth,
  rpgCloudEnabled,
  savePlayerAccount,
  signInPlayer,
  signOutPlayer,
  signUpPlayer
} from "./lib/rpgCloud";

const STORAGE_KEY = "rpg-fichario-v1";
const SESSION_KEY = "rpg-fichario-session";
const CLOUD_CACHE_PREFIX = "rpg-fichario-cloud-";

const emptyCharacter = {
  name: "",
  system: "D&D 5e",
  ancestry: "",
  className: "",
  level: 1,
  experience: 0,
  playerName: "",
  background: "",
  alignment: "",
  portrait: "",
  portraitImage: "",
  conceptImage: "",
  hp: 10,
  maxHp: 10,
  mana: 0,
  maxMana: 0,
  armorClass: 10,
  initiative: 0,
  speed: "9m",
  proficiency: 2,
  attributes: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  },
  skills: "",
  attacks: "",
  equipment: "",
  inventoryItems: [],
  spells: "",
  spellCards: [],
  notes: "",
  story: ""
};

const attributeLabels = [
  ["strength", "Forca"],
  ["dexterity", "Destreza"],
  ["constitution", "Constituicao"],
  ["intelligence", "Inteligencia"],
  ["wisdom", "Sabedoria"],
  ["charisma", "Carisma"]
];

const diceOptions = [4, 6, 8, 10, 12, 20, 100];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadVault() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed?.accounts ? parsed : { accounts: [] };
  } catch {
    return { accounts: [] };
  }
}

function saveVault(vault) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
}

function passwordHash(value) {
  return btoa(unescape(encodeURIComponent(value)));
}

function createAccount(name, id = makeId("account"), email = "") {
  return {
    id,
    name,
    email,
    profile: {
      displayName: name,
      photo: "",
      title: "Jogador da mesa",
      favoriteSystem: "",
      favoriteRole: "",
      contact: "",
      availability: "",
      campaign: "",
      bio: ""
    },
    rolls: [],
    master: {
      campaignName: "Campanha principal",
      nextSession: "",
      sessionStatus: "Preparando aventura",
      npcs: [],
      monsters: [],
      secrets: [],
      combatants: [],
      turnIndex: 0,
      journal: []
    },
    characters: [],
    createdAt: new Date().toISOString()
  };
}

function characterSummary(character) {
  return [character.ancestry, character.className, character.level ? `nivel ${character.level}` : ""].filter(Boolean).join(" / ");
}

function experienceGoalForLevel(level) {
  return Math.max(1, Number(level) || 1) * 100;
}

function profileFor(account) {
  return {
    displayName: account.profile?.displayName ?? account.name,
    photo: account.profile?.photo ?? "",
    title: account.profile?.title ?? "Jogador da mesa",
    favoriteSystem: account.profile?.favoriteSystem ?? "",
    favoriteRole: account.profile?.favoriteRole ?? "",
    contact: account.profile?.contact ?? "",
    availability: account.profile?.availability ?? "",
    campaign: account.profile?.campaign ?? "",
    bio: account.profile?.bio ?? ""
  };
}

function rollsFor(account) {
  return account.rolls ?? [];
}

function masterFor(account) {
  return {
    campaignName: account.master?.campaignName ?? "Campanha principal",
    nextSession: account.master?.nextSession ?? "",
    sessionStatus: account.master?.sessionStatus ?? "Preparando aventura",
    npcs: account.master?.npcs ?? [],
    monsters: account.master?.monsters ?? [],
    secrets: account.master?.secrets ?? [],
    combatants: account.master?.combatants ?? [],
    turnIndex: account.master?.turnIndex ?? 0,
    journal: account.master?.journal ?? []
  };
}

function addJournal(master, text) {
  return {
    ...master,
    journal: [
      { id: makeId("journal"), text, createdAt: new Date().toISOString() },
      ...(master.journal ?? [])
    ].slice(0, 80)
  };
}

function formatRollTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function LoadingScreen() {
  return (
    <main className="loading-shell" aria-busy="true" aria-label="Carregando app">
      <section className="loading-card">
        <div className="loading-mark">d20</div>
        <div>
          <p className="eyebrow">Preparando mesa</p>
          <h1>Fichario de RPG</h1>
        </div>
        <div className="skeleton-stack" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}

function AuthScreen({ cloudEnabled, vault, onLogin, onRegister, onCloudAuth, cloudMessage }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const cleanName = name.trim();

    if (cloudEnabled) {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === "register" && cleanName.length < 2) return setMessage("Use um nome com pelo menos 2 letras.");
      if (!cleanEmail.includes("@")) return setMessage("Digite um e-mail valido.");
      if (password.length < 6) return setMessage("Use uma senha com pelo menos 6 caracteres.");
      setSubmitting(true);
      const result = await onCloudAuth(mode, { name: cleanName, email: cleanEmail, password });
      setSubmitting(false);
      setMessage(result.message ?? "");
      return;
    }

    if (cleanName.length < 2) return setMessage("Use um nome com pelo menos 2 letras.");
    if (password.length < 4) return setMessage("Use uma senha com pelo menos 4 caracteres.");

    const existing = vault.accounts.find((account) => account.name.toLowerCase() === cleanName.toLowerCase());
    if (mode === "login") {
      if (!existing || existing.password !== passwordHash(password)) return setMessage("Nome ou senha nao conferem.");
      onLogin(existing.id);
      return;
    }

    if (existing) return setMessage("Esse nome ja esta cadastrado.");
    onRegister(cleanName, password);
  }

  return (
    <main className="auth-shell">
      <section className="table-scene" aria-hidden="true">
        <div className="map-sheet" />
        <div className="dice d20">20</div>
        <div className="dice d12">12</div>
        <div className="token token-a" />
        <div className="token token-b" />
      </section>

      <motion.section className="auth-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Mesa dos amigos</p>
        <h1>Fichario de RPG</h1>
        <p className="lead">Cada jogador entra com sua senha e guarda quantos personagens quiser.</p>

        <div className="segmented" role="tablist" aria-label="Entrar ou cadastrar">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>Entrar</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>Cadastrar</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {!cloudEnabled || mode === "register" ? (
            <label>
              Nome
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Pedro" autoComplete="name" />
            </label>
          ) : null}
          {cloudEnabled ? (
            <label>
              E-mail
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" type="email" autoComplete="email" />
            </label>
          ) : null}
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {message || cloudMessage ? <p className="form-message">{message || cloudMessage}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? "Conectando..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
      </motion.section>
    </main>
  );
}

function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state-card">
      <strong>{title}</strong>
      <p>{children}</p>
      {action}
    </div>
  );
}

function CharacterList({ characters, selectedId, onSelect, onCreate, onDuplicate, onDelete }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div>
          <p className="eyebrow">Personagens</p>
          <h2>{characters.length}</h2>
        </div>
        <button type="button" onClick={onCreate}>Novo</button>
      </div>

      <div className="character-list">
        {characters.length === 0 ? (
          <EmptyState
            title="Nenhuma ficha ainda"
            action={<button type="button" onClick={onCreate}>Criar primeira ficha</button>}
          >
            Crie um personagem para acessar ficha, inventario, magias e combate rapido.
          </EmptyState>
        ) : null}
        {characters.map((character) => (
          <article className={character.id === selectedId ? "character-card active" : "character-card"} key={character.id}>
            <button type="button" onClick={() => onSelect(character.id)}>
              <span className="portrait">
                {character.portraitImage ? <img src={character.portraitImage} alt="" /> : character.portrait || character.name.charAt(0) || "?"}
              </span>
              <span>
                <strong>{character.name || "Sem nome"}</strong>
                <small>{characterSummary(character) || character.system}</small>
              </span>
            </button>
            <div className="card-actions">
              <button type="button" onClick={() => onDuplicate(character.id)}>Duplicar</button>
              <button type="button" className="danger" onClick={() => onDelete(character.id)}>Apagar</button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function ProfilePhoto({ profile, size = "default" }) {
  const initials = (profile.displayName || "?").trim().slice(0, 2).toUpperCase();
  return (
    <div className={size === "large" ? "player-photo large" : "player-photo"}>
      {profile.photo ? <img src={profile.photo} alt="" /> : <span>{initials}</span>}
    </div>
  );
}

function ProfilePanel({ account, characters, onUpdate }) {
  const profile = profileFor(account);
  const highestLevel = characters.reduce((max, character) => Math.max(max, Number(character.level) || 0), 0);

  function updateProfile(field, value) {
    onUpdate({ ...account, profile: { ...profile, [field]: value } });
  }

  function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateProfile("photo", reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <section className="profile-panel">
      <div className="profile-hero">
        <ProfilePhoto profile={profile} size="large" />
        <div>
          <p className="eyebrow">Perfil do jogador</p>
          <h2>{profile.displayName}</h2>
          <span>{profile.title}</span>
        </div>
      </div>

      <div className="profile-stats">
        <span><strong>{characters.length}</strong> fichas</span>
        <span><strong>{highestLevel || "-"}</strong> maior nivel</span>
        <span><strong>{profile.favoriteSystem || "-"}</strong> sistema</span>
      </div>

      <div className="profile-form">
        <label className="photo-upload">
          Foto do jogador
          <input type="file" accept="image/*" onChange={handlePhoto} />
        </label>
        {profile.photo ? (
          <button type="button" className="subtle-button" onClick={() => updateProfile("photo", "")}>Remover foto</button>
        ) : null}
        <TextField label="Nome exibido" value={profile.displayName} onChange={(value) => updateProfile("displayName", value)} />
        <TextField label="Titulo" value={profile.title} onChange={(value) => updateProfile("title", value)} placeholder="Mestre, estrategista, suporte..." />
        <TextField label="Sistema favorito" value={profile.favoriteSystem} onChange={(value) => updateProfile("favoriteSystem", value)} placeholder="D&D, Tormenta, Ordem..." />
        <TextField label="Estilo de jogo" value={profile.favoriteRole} onChange={(value) => updateProfile("favoriteRole", value)} placeholder="Roleplay, combate, investigacao..." />
        <TextField label="Contato" value={profile.contact} onChange={(value) => updateProfile("contact", value)} placeholder="Discord, WhatsApp..." />
        <TextField label="Disponibilidade" value={profile.availability} onChange={(value) => updateProfile("availability", value)} placeholder="Sabados a noite..." />
        <TextField label="Campanha atual" value={profile.campaign} onChange={(value) => updateProfile("campaign", value)} placeholder="Nome da campanha" />
        <TextArea label="Sobre voce na mesa" value={profile.bio} onChange={(value) => updateProfile("bio", value)} placeholder="O que gosta de jogar, limites, objetivos, estilo de personagem..." />
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, type = "text", min, max, placeholder }) {
  return (
    <label>
      {label}
      <input type={type} min={min} max={max} value={value} placeholder={placeholder} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }) {
  return (
    <label className="wide">
      {label}
      <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ImageUpload({ label, value, onChange }) {
  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="image-upload">
      <label>
        {label}
        <input type="file" accept="image/*" onChange={handleFile} />
      </label>
      {value ? <button type="button" className="subtle-button" onClick={() => onChange("")}>Remover imagem</button> : null}
    </div>
  );
}

function BottomNav({ activeView, onChange }) {
  const items = [
    ["home", "Inicio"],
    ["characters", "Personagens"],
    ["campaigns", "Campanhas"],
    ["dice", "Dados"],
    ["master", "Mestre"]
  ];

  return (
    <nav className="bottom-nav" aria-label="Navegacao principal">
      {items.map(([id, label]) => (
        <button
          aria-current={activeView === id ? "page" : undefined}
          className={activeView === id ? "active" : ""}
          type="button"
          key={id}
          onClick={() => onChange(id)}
        >
          <span>{label.charAt(0)}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}

function HomeView({ account, profile, selected, onOpenCharacters, onOpenSheet, onCreateCharacter }) {
  const lastCharacter = account.characters[0];

  return (
    <section className="home-view">
      <div className="hero-card">
        <ProfilePhoto profile={profile} size="large" />
        <div>
          <p className="eyebrow">Bem-vindo a mesa</p>
          <h2>{profile.displayName}</h2>
          <p>{profile.campaign || "Organize seus personagens, rolagens e sessoes em um app feito para jogar pelo celular."}</p>
        </div>
      </div>

      <div className="quick-grid">
        <button type="button" onClick={selected ? onOpenSheet : onCreateCharacter}>
          <strong>{selected ? selected.name : "Criar personagem"}</strong>
          <span>{selected ? "Abrir ficha ativa" : "Comece uma nova ficha"}</span>
        </button>
        <button type="button" onClick={onOpenCharacters}>
          <strong>{account.characters.length}</strong>
          <span>personagens salvos</span>
        </button>
      </div>

      <section className="session-card">
        <p className="eyebrow">Atalhos da sessao</p>
        <div className="session-actions">
          <button type="button" onClick={onOpenSheet} disabled={!selected}>Ficha ativa</button>
          <button type="button" onClick={onOpenCharacters}>Trocar personagem</button>
          <button type="button">Registrar nota</button>
        </div>
      </section>

      <section className="home-list">
        <p className="eyebrow">Ultimo personagem</p>
        {lastCharacter ? (
          <article>
            <span className="portrait">
              {lastCharacter.portraitImage ? <img src={lastCharacter.portraitImage} alt="" /> : lastCharacter.portrait || lastCharacter.name.charAt(0) || "?"}
            </span>
            <div>
              <strong>{lastCharacter.name}</strong>
              <small>{characterSummary(lastCharacter) || lastCharacter.system}</small>
            </div>
          </article>
        ) : (
          <p className="empty">Nenhum personagem criado ainda.</p>
        )}
      </section>
    </section>
  );
}

function PlaceholderView({ eyebrow, title, children }) {
  return (
    <section className="placeholder-view">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

function DiceHistory({ rolls }) {
  return (
    <section className="roll-history">
      <div className="section-row">
        <div>
          <p className="eyebrow">Historico</p>
          <h3>Ultimas rolagens</h3>
        </div>
        <span>{rolls.length}</span>
      </div>
      <div className="roll-list">
        {!rolls.length ? (
          <EmptyState title="Sem rolagens">
            Role qualquer dado para registrar o historico da sessao.
          </EmptyState>
        ) : null}
        {rolls.slice(0, 12).map((roll) => (
          <article key={roll.id}>
            <strong>{roll.result}</strong>
            <div>
              <span>d{roll.sides}</span>
              <small>{roll.characterName || "Sem personagem"} / {formatRollTime(roll.createdAt)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DicePanel({ selected, rolls, onRoll }) {
  return (
    <section className="dice-view">
      <div className="dice-hero">
        <p className="eyebrow">Rolagens rapidas</p>
        <h2>Dados da mesa</h2>
        <p>{selected ? `Rolando como ${selected.name}.` : "Role sem personagem ou crie uma ficha para vincular o historico."}</p>
      </div>

      <div className="dice-grid">
        {diceOptions.map((sides) => (
          <button type="button" key={sides} onClick={() => onRoll(sides)}>
            <span>d{sides}</span>
            Rolar
          </button>
        ))}
      </div>

      <DiceHistory rolls={rolls} />
    </section>
  );
}

function DiceModal({ roll, onClose, onRoll }) {
  if (!roll) return null;

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.section
        aria-modal="true"
        aria-labelledby="dice-result-title"
        className="dice-modal"
        initial={{ y: 24, scale: .96 }}
        role="dialog"
        animate={{ y: 0, scale: 1 }}
      >
        <p className="eyebrow">{roll.rolling ? "Rolando" : "Resultado"}</p>
        <div className={roll.rolling ? "rolling-die rolling" : "rolling-die"}>
          <span id="dice-result-title">{roll.rolling ? "?" : roll.result}</span>
        </div>
        <p>d{roll.sides} / {roll.characterName || "Sem personagem"}</p>
        <div className="dice-modal-actions">
          <button type="button" onClick={() => onRoll(roll.sides)} disabled={roll.rolling}>Rolar d{roll.sides} de novo</button>
          <button type="button" className="subtle-button" onClick={onClose}>Fechar</button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function FloatingDiceButton({ onClick }) {
  return (
    <button className="floating-dice" type="button" onClick={onClick} aria-label="Abrir dados">
      d20
    </button>
  );
}

function CampaignsView({ master, characters, onUpdate }) {
  function updateField(field, value) {
    onUpdate(addJournal({ ...master, [field]: value }, `Campanha atualizada: ${field}`));
  }

  return (
    <section className="campaign-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Campanhas</p>
          <h2>{master.campaignName}</h2>
          <p>{master.sessionStatus}</p>
        </div>
      </div>

      <div className="form-grid">
        <TextField label="Nome da campanha" value={master.campaignName} onChange={(value) => updateField("campaignName", value)} />
        <TextField label="Proxima sessao" value={master.nextSession} onChange={(value) => updateField("nextSession", value)} placeholder="Sabado, 20h" />
        <TextField label="Status" value={master.sessionStatus} onChange={(value) => updateField("sessionStatus", value)} />
      </div>

      <div className="quick-grid">
        <button type="button">
          <strong>{characters.length}</strong>
          <span>personagens na mesa</span>
        </button>
        <button type="button">
          <strong>{master.journal.length}</strong>
          <span>eventos registrados</span>
        </button>
      </div>
    </section>
  );
}

function MasterDesk({ account, master, onUpdate }) {
  const [npcName, setNpcName] = useState("");
  const [secretText, setSecretText] = useState("");
  const [combatName, setCombatName] = useState("");
  const [combatInitiative, setCombatInitiative] = useState(10);

  function commit(nextMaster) {
    onUpdate({ ...account, master: nextMaster });
  }

  function addNpc(event) {
    event.preventDefault();
    const clean = npcName.trim();
    if (!clean) return;
    const npc = {
      id: makeId("npc"),
      name: clean,
      description: "",
      hp: 10,
      notes: "",
      attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    };
    commit(addJournal({ ...master, npcs: [npc, ...master.npcs] }, `NPC criado: ${clean}`));
    setNpcName("");
  }

  function updateNpc(id, field, value) {
    commit({ ...master, npcs: master.npcs.map((npc) => npc.id === id ? { ...npc, [field]: value } : npc) });
  }

  function removeNpc(id) {
    const npc = master.npcs.find((item) => item.id === id);
    commit(addJournal({ ...master, npcs: master.npcs.filter((item) => item.id !== id) }, `NPC removido: ${npc?.name ?? "sem nome"}`));
  }

  function addSecret(event) {
    event.preventDefault();
    const clean = secretText.trim();
    if (!clean) return;
    commit(addJournal({
      ...master,
      secrets: [{ id: makeId("secret"), text: clean, createdAt: new Date().toISOString() }, ...master.secrets]
    }, "Nota secreta adicionada"));
    setSecretText("");
  }

  function removeSecret(id) {
    commit({ ...master, secrets: master.secrets.filter((secret) => secret.id !== id) });
  }

  function addCombatant(event) {
    event.preventDefault();
    const clean = combatName.trim();
    if (!clean) return;
    const combatant = { id: makeId("combatant"), name: clean, initiative: Number(combatInitiative) || 0, type: "participante" };
    const combatants = [combatant, ...master.combatants].sort((a, b) => Number(b.initiative) - Number(a.initiative));
    commit(addJournal({ ...master, combatants, turnIndex: 0 }, `Entrou na iniciativa: ${clean}`));
    setCombatName("");
    setCombatInitiative(10);
  }

  function stepTurn(delta) {
    if (!master.combatants.length) return;
    const nextIndex = (master.turnIndex + delta + master.combatants.length) % master.combatants.length;
    commit(addJournal({ ...master, turnIndex: nextIndex }, `Turno: ${master.combatants[nextIndex].name}`));
  }

  function removeCombatant(id) {
    const combatants = master.combatants.filter((item) => item.id !== id);
    commit({ ...master, combatants, turnIndex: Math.min(master.turnIndex, Math.max(0, combatants.length - 1)) });
  }

  const currentTurn = master.combatants[master.turnIndex];
  const nextTurn = master.combatants[(master.turnIndex + 1) % Math.max(1, master.combatants.length)];

  return (
    <section className="master-view">
      <div className="hero-card master-hero">
        <div>
          <p className="eyebrow">Mesa do Mestre</p>
          <h2>{master.campaignName}</h2>
          <p>{master.nextSession ? `Proxima sessao: ${master.nextSession}` : "Prepare a sessao, conduza combate e guarde segredos."}</p>
        </div>
      </div>

      <div className="master-dashboard">
        <span><strong>1</strong> campanha ativa</span>
        <span><strong>{account.characters.length}</strong> personagens</span>
        <span><strong>{master.npcs.length}</strong> NPCs</span>
        <span><strong>{master.combatants.length}</strong> iniciativa</span>
      </div>

      <section className="master-card">
        <div className="section-row">
          <div>
            <p className="eyebrow">Controle de combate</p>
            <h3>{currentTurn ? `Turno de ${currentTurn.name}` : "Sem combate ativo"}</h3>
          </div>
          {nextTurn ? <span>Proximo: {nextTurn.name}</span> : null}
        </div>
        <form className="inline-form" onSubmit={addCombatant}>
          <input value={combatName} onChange={(event) => setCombatName(event.target.value)} placeholder="Participante ou NPC" />
          <input type="number" value={combatInitiative} onChange={(event) => setCombatInitiative(event.target.value)} />
          <button type="submit">Adicionar</button>
        </form>
        <div className="turn-actions">
          <button type="button" onClick={() => stepTurn(-1)}>Voltar turno</button>
          <button type="button" onClick={() => stepTurn(1)}>Proximo turno</button>
        </div>
        <div className="stack-list">
          {!master.combatants.length ? (
            <EmptyState title="Sem iniciativa ativa">
              Adicione jogadores, NPCs ou monstros para controlar a ordem de turnos.
            </EmptyState>
          ) : null}
          {master.combatants.map((combatant, index) => (
            <article className={index === master.turnIndex ? "active" : ""} key={combatant.id}>
              <strong>{combatant.name}</strong>
              <span>Iniciativa {combatant.initiative}</span>
              <button type="button" onClick={() => removeCombatant(combatant.id)}>Remover</button>
            </article>
          ))}
        </div>
      </section>

      <section className="master-card">
        <div className="section-row">
          <div>
            <p className="eyebrow">NPCs</p>
            <h3>Elenco da campanha</h3>
          </div>
        </div>
        <form className="inline-form" onSubmit={addNpc}>
          <input value={npcName} onChange={(event) => setNpcName(event.target.value)} placeholder="Nome do NPC" />
          <button type="submit">Adicionar NPC</button>
        </form>
        <div className="npc-grid">
          {!master.npcs.length ? (
            <EmptyState title="Nenhum NPC criado">
              Crie aliados, rivais e informantes para consultar durante a sessao.
            </EmptyState>
          ) : null}
          {master.npcs.map((npc) => (
            <article className="game-card" key={npc.id}>
              <input value={npc.name} onChange={(event) => updateNpc(npc.id, "name", event.target.value)} />
              <TextField label="Vida" type="number" value={npc.hp} onChange={(value) => updateNpc(npc.id, "hp", value)} />
              <textarea value={npc.description} onChange={(event) => updateNpc(npc.id, "description", event.target.value)} placeholder="Descricao" />
              <textarea value={npc.notes} onChange={(event) => updateNpc(npc.id, "notes", event.target.value)} placeholder="Anotacoes" />
              <button type="button" className="subtle-button danger-text" onClick={() => removeNpc(npc.id)}>Remover NPC</button>
            </article>
          ))}
        </div>
      </section>

      <section className="master-card">
        <div className="section-row">
          <div>
            <p className="eyebrow">Anotacoes secretas</p>
            <h3>Segredos do mestre</h3>
          </div>
        </div>
        <form className="inline-form secret-form" onSubmit={addSecret}>
          <input value={secretText} onChange={(event) => setSecretText(event.target.value)} placeholder="Plot twist, pista oculta, segredo..." />
          <button type="submit">Salvar segredo</button>
        </form>
        <div className="stack-list">
          {!master.secrets.length ? (
            <EmptyState title="Sem segredos ainda">
              Salve pistas ocultas, reviravoltas e informacoes que os jogadores ainda nao sabem.
            </EmptyState>
          ) : null}
          {master.secrets.map((secret) => (
            <article key={secret.id}>
              <strong>{secret.text}</strong>
              <span>{formatRollTime(secret.createdAt)}</span>
              <button type="button" onClick={() => removeSecret(secret.id)}>Remover</button>
            </article>
          ))}
        </div>
      </section>

      <section className="master-card">
        <div className="section-row">
          <div>
            <p className="eyebrow">Diario da campanha</p>
            <h3>Eventos recentes</h3>
          </div>
        </div>
        <div className="stack-list">
          {!master.journal.length ? (
            <EmptyState title="Diario vazio">
              Eventos de NPCs, iniciativa, segredos e campanha aparecem aqui automaticamente.
            </EmptyState>
          ) : null}
          {master.journal.slice(0, 20).map((entry) => (
            <article key={entry.id}>
              <strong>{entry.text}</strong>
              <span>{formatRollTime(entry.createdAt)}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function CharacterEditor({ character, onChange, onSave, onDiscard, hasChanges, saveMessage }) {
  const [sheetTab, setSheetTab] = useState("general");
  const [inventorySearch, setInventorySearch] = useState("");
  const [spellSearch, setSpellSearch] = useState("");

  if (!character) {
    return (
      <section className="sheet empty-sheet">
        <h2>Crie uma ficha</h2>
        <p>O painel de personagem aparece aqui assim que voce cadastrar a primeira ficha.</p>
      </section>
    );
  }

  function update(field, value) {
    onChange({ ...character, [field]: value, updatedAt: new Date().toISOString() });
  }

  function updateAttribute(field, value) {
    onChange({
      ...character,
      attributes: { ...character.attributes, [field]: value },
      updatedAt: new Date().toISOString()
    });
  }

  function adjust(field, delta) {
    const next = Math.max(0, Number(character[field] ?? 0) + delta);
    update(field, next);
  }

  function setLevel(value) {
    const nextLevel = Math.min(30, Math.max(1, Number(value) || 1));
    onChange({
      ...character,
      level: nextLevel,
      experience: nextLevel === 30
        ? 0
        : Math.min(Math.max(0, Number(character.experience) || 0), experienceGoalForLevel(nextLevel) - 1),
      updatedAt: new Date().toISOString()
    });
  }

  function addExperience(amount) {
    let nextLevel = Math.min(30, Math.max(1, Number(character.level) || 1));
    let nextExperience = Math.max(0, Number(character.experience) || 0) + amount;

    while (nextLevel < 30 && nextExperience >= experienceGoalForLevel(nextLevel)) {
      nextExperience -= experienceGoalForLevel(nextLevel);
      nextLevel += 1;
    }

    onChange({
      ...character,
      level: nextLevel,
      experience: nextLevel === 30 ? 0 : Math.max(0, nextExperience),
      updatedAt: new Date().toISOString()
    });
  }

  function addInventoryItem() {
    update("inventoryItems", [
      ...(character.inventoryItems ?? []),
      { id: makeId("item"), name: "Novo item", category: "Geral", quantity: 1, weight: 0, notes: "" }
    ]);
  }

  function updateInventoryItem(id, field, value) {
    update("inventoryItems", (character.inventoryItems ?? []).map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeInventoryItem(id) {
    update("inventoryItems", (character.inventoryItems ?? []).filter((item) => item.id !== id));
  }

  function addSpellCard() {
    update("spellCards", [
      ...(character.spellCards ?? []),
      { id: makeId("spell"), name: "Nova magia", range: "", cost: "", description: "" }
    ]);
  }

  function updateSpellCard(id, field, value) {
    update("spellCards", (character.spellCards ?? []).map((spell) => spell.id === id ? { ...spell, [field]: value } : spell));
  }

  function removeSpellCard(id) {
    update("spellCards", (character.spellCards ?? []).filter((spell) => spell.id !== id));
  }

  const inventoryItems = character.inventoryItems ?? [];
  const spellCards = character.spellCards ?? [];
  const currentLevel = Math.min(30, Math.max(1, Number(character.level) || 1));
  const currentExperience = Math.max(0, Number(character.experience) || 0);
  const experienceGoal = experienceGoalForLevel(currentLevel);
  const experiencePercent = currentLevel === 30 ? 100 : Math.min(100, (currentExperience / experienceGoal) * 100);
  const filteredItems = inventoryItems.filter((item) =>
    `${item.name} ${item.category} ${item.notes}`.toLowerCase().includes(inventorySearch.toLowerCase())
  );
  const filteredSpells = spellCards.filter((spell) =>
    `${spell.name} ${spell.range} ${spell.cost} ${spell.description}`.toLowerCase().includes(spellSearch.toLowerCase())
  );

  return (
    <section className="sheet">
      <div className="sheet-title">
        <div>
          <p className="eyebrow">{character.system}</p>
          <h2>{character.name || "Personagem sem nome"}</h2>
          <span>{characterSummary(character) || "Ficha em construcao"}</span>
        </div>
        <div className="portrait large">
          {character.portraitImage ? <img src={character.portraitImage} alt="" /> : character.portrait || character.name.charAt(0) || "?"}
        </div>
      </div>

      <div className={hasChanges ? "save-strip active" : "save-strip"} aria-live="polite">
        <span>{hasChanges ? "Alteracoes ainda nao salvas" : saveMessage || "Ficha salva"}</span>
        <div>
          <button type="button" className="subtle-button" onClick={onDiscard} disabled={!hasChanges}>Desfazer</button>
          <button type="button" onClick={onSave} disabled={!hasChanges}>Salvar ficha</button>
        </div>
      </div>

      <div className="sheet-tabs" role="tablist" aria-label="Secoes da ficha">
        {[
          ["general", "Geral"],
          ["attributes", "Atributos"],
          ["combat", "Combate"],
          ["inventory", "Inventario"],
          ["spells", "Magias"]
        ].map(([id, label]) => (
          <button className={sheetTab === id ? "active" : ""} type="button" key={id} onClick={() => setSheetTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {sheetTab === "general" ? (
        <>
          <div className="character-media-grid">
            <section className="media-card">
              <div className="media-preview portrait-preview">
                {character.portraitImage ? <img src={character.portraitImage} alt="" /> : <span>{character.portrait || character.name.charAt(0) || "?"}</span>}
              </div>
              <ImageUpload label="Foto do personagem" value={character.portraitImage} onChange={(value) => update("portraitImage", value)} />
            </section>

            <section className="media-card">
              <div className="media-preview concept-preview">
                {character.conceptImage ? <img src={character.conceptImage} alt="" /> : <span>Conceito visual</span>}
              </div>
              <ImageUpload label="Foto conceito" value={character.conceptImage} onChange={(value) => update("conceptImage", value)} />
            </section>
          </div>

          <div className="form-grid">
            <TextField label="Nome do personagem" value={character.name} onChange={(value) => update("name", value)} placeholder="Nome" />
            <TextField label="Sistema" value={character.system} onChange={(value) => update("system", value)} placeholder="D&D, Tormenta, Ordem..." />
            <TextField label="Raca" value={character.ancestry} onChange={(value) => update("ancestry", value)} placeholder="Humano, elfo..." />
            <TextField label="Classe" value={character.className} onChange={(value) => update("className", value)} placeholder="Guerreiro, mago..." />
            <TextField label="Nivel" type="number" min="1" max="30" value={currentLevel} onChange={setLevel} />
            <TextField label="Jogador" value={character.playerName} onChange={(value) => update("playerName", value)} placeholder="Quem joga" />
            <TextField label="Historico" value={character.background} onChange={(value) => update("background", value)} placeholder="Soldado, academico..." />
            <TextField label="Conceito" value={character.alignment} onChange={(value) => update("alignment", value)} placeholder="Leal bom, anti-heroi..." />
            <TextField label="Avatar curto" value={character.portrait} onChange={(value) => update("portrait", value.slice(0, 2).toUpperCase())} placeholder="AB" />
          </div>

          <section className="level-progress-card" aria-label="Progressao do personagem">
            <div className="level-badge">
              <span>Nivel</span>
              <strong>{currentLevel}</strong>
            </div>
            <div className="level-progress-main">
              <div className="level-progress-heading">
                <div>
                  <p className="eyebrow">Experiencia</p>
                  <strong>{currentLevel === 30 ? "Nivel maximo alcancado" : `${currentExperience} / ${experienceGoal} XP`}</strong>
                </div>
                {currentLevel < 30 ? <span>Proximo: nivel {currentLevel + 1}</span> : null}
              </div>
              <div className="experience-track" role="progressbar" aria-label="Experiencia para o proximo nivel" aria-valuemin="0" aria-valuemax={experienceGoal} aria-valuenow={currentLevel === 30 ? experienceGoal : currentExperience}>
                <span style={{ width: `${experiencePercent}%` }} />
              </div>
              <div className="experience-actions">
                <button type="button" className="subtle-button" onClick={() => addExperience(-10)} disabled={currentLevel === 30 || currentExperience === 0}>-10 XP</button>
                <button type="button" onClick={() => addExperience(10)} disabled={currentLevel === 30}>+10 XP</button>
                <button type="button" onClick={() => addExperience(50)} disabled={currentLevel === 30}>+50 XP</button>
                <button type="button" onClick={() => addExperience(100)} disabled={currentLevel === 30}>+100 XP</button>
                <button type="button" className="level-up-button" onClick={() => addExperience(experienceGoal - currentExperience)} disabled={currentLevel === 30}>Subir nivel</button>
              </div>
            </div>
          </section>

          <div className="form-grid notes-grid">
            <TextArea label="Historia" value={character.story} onChange={(value) => update("story", value)} placeholder="Origem, objetivos, aliados, traumas..." />
            <TextArea label="Anotacoes da sessao" value={character.notes} onChange={(value) => update("notes", value)} placeholder="Pistas, NPCs, missoes, tesouros..." />
          </div>
        </>
      ) : null}

      {sheetTab === "attributes" ? (
        <div className="attribute-board">
          {attributeLabels.map(([key, label]) => (
            <label className="attribute-card" key={key}>
              <span>{label}</span>
              <input type="number" value={character.attributes[key]} onChange={(event) => updateAttribute(key, Number(event.target.value))} />
            </label>
          ))}
          <TextArea label="Pericias e talentos" value={character.skills} onChange={(value) => update("skills", value)} placeholder="Acrobacia +5, furtividade +4..." />
        </div>
      ) : null}

      {sheetTab === "combat" ? (
        <div className="combat-board">
          {[
            ["hp", "Vida atual"],
            ["maxHp", "Vida maxima"],
            ["mana", "Mana atual"],
            ["maxMana", "Mana maxima"]
          ].map(([field, label]) => (
            <section className="combat-card" key={field}>
              <span>{label}</span>
              <strong>{Number(character[field] ?? 0)}</strong>
              <div>
                {[-5, -1, 1, 5].map((delta) => (
                  <button type="button" key={delta} onClick={() => adjust(field, delta)}>
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <div className="form-grid">
            <TextField label="Defesa" type="number" value={character.armorClass} onChange={(value) => update("armorClass", value)} />
            <TextField label="Iniciativa" type="number" value={character.initiative} onChange={(value) => update("initiative", value)} />
            <TextField label="Deslocamento" value={character.speed} onChange={(value) => update("speed", value)} />
            <TextField label="Proficiencia" type="number" value={character.proficiency} onChange={(value) => update("proficiency", value)} />
          </div>
          <TextArea label="Ataques e acoes" value={character.attacks} onChange={(value) => update("attacks", value)} placeholder="Espada longa +6, bola de fogo..." />
        </div>
      ) : null}

      {sheetTab === "inventory" ? (
        <div className="game-list-section">
          <div className="list-toolbar">
            <input className="search-input" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Pesquisar item..." />
            <button type="button" onClick={addInventoryItem}>Adicionar item</button>
          </div>
          <div className="item-grid">
            {!filteredItems.length ? <p className="empty">Nenhum item encontrado.</p> : null}
            {filteredItems.map((item) => (
              <article className="game-card" key={item.id}>
                <input value={item.name} onChange={(event) => updateInventoryItem(item.id, "name", event.target.value)} placeholder="Nome do item" />
                <div className="mini-grid">
                  <label>
                    Categoria
                    <input value={item.category} onChange={(event) => updateInventoryItem(item.id, "category", event.target.value)} />
                  </label>
                  <label>
                    Qtd
                    <input type="number" value={item.quantity} onChange={(event) => updateInventoryItem(item.id, "quantity", Number(event.target.value))} />
                  </label>
                  <label>
                    Peso
                    <input type="number" value={item.weight} onChange={(event) => updateInventoryItem(item.id, "weight", Number(event.target.value))} />
                  </label>
                </div>
                <textarea value={item.notes} onChange={(event) => updateInventoryItem(item.id, "notes", event.target.value)} placeholder="Detalhes, bonus, local onde esta guardado..." />
                <button type="button" className="subtle-button danger-text" onClick={() => removeInventoryItem(item.id)}>Remover</button>
              </article>
            ))}
          </div>
          <TextArea label="Notas antigas do inventario" value={character.equipment} onChange={(value) => update("equipment", value)} placeholder="Itens soltos, ouro, observacoes..." />
        </div>
      ) : null}

      {sheetTab === "spells" ? (
        <div className="game-list-section">
          <div className="list-toolbar">
            <input className="search-input" value={spellSearch} onChange={(event) => setSpellSearch(event.target.value)} placeholder="Pesquisar magia..." />
            <button type="button" onClick={addSpellCard}>Adicionar magia</button>
          </div>
          <div className="spell-grid">
            {!filteredSpells.length ? <p className="empty">Nenhuma magia encontrada.</p> : null}
            {filteredSpells.map((spell) => (
              <article className="game-card spell-card" key={spell.id}>
                <input value={spell.name} onChange={(event) => updateSpellCard(spell.id, "name", event.target.value)} placeholder="Nome da magia" />
                <div className="mini-grid">
                  <label>
                    Alcance
                    <input value={spell.range} onChange={(event) => updateSpellCard(spell.id, "range", event.target.value)} placeholder="18m, toque..." />
                  </label>
                  <label>
                    Custo
                    <input value={spell.cost} onChange={(event) => updateSpellCard(spell.id, "cost", event.target.value)} placeholder="Mana, slot..." />
                  </label>
                </div>
                <textarea value={spell.description} onChange={(event) => updateSpellCard(spell.id, "description", event.target.value)} placeholder="Descricao, efeito, duracao..." />
                <button type="button" className="subtle-button danger-text" onClick={() => removeSpellCard(spell.id)}>Remover</button>
              </article>
            ))}
          </div>
          <TextArea label="Notas antigas de magias" value={character.spells} onChange={(value) => update("spells", value)} placeholder="Lista antiga, poderes soltos, observacoes..." />
        </div>
      ) : null}
    </section>
  );
}

function Dashboard({ account, onLogout, onUpdateAccount }) {
  const [selectedId, setSelectedId] = useState(account.characters[0]?.id ?? null);
  const [activeView, setActiveView] = useState("home");
  const [characterMode, setCharacterMode] = useState(account.characters.length ? "sheet" : "list");
  const [lastRoll, setLastRoll] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const profile = profileFor(account);
  const rolls = rollsFor(account);
  const master = masterFor(account);
  const selected = useMemo(
    () => account.characters.find((character) => character.id === selectedId) ?? account.characters[0] ?? null,
    [account.characters, selectedId]
  );
  const [draftCharacter, setDraftCharacter] = useState(selected);
  const hasDraftChanges = Boolean(selected && draftCharacter && JSON.stringify(selected) !== JSON.stringify(draftCharacter));

  useEffect(() => {
    setDraftCharacter(selected);
  }, [selected?.id]);

  function createCharacter() {
    const character = {
      ...emptyCharacter,
      id: makeId("character"),
      name: "Novo personagem",
      playerName: account.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onUpdateAccount({ ...account, characters: [character, ...account.characters] });
    setSelectedId(character.id);
    setActiveView("characters");
    setCharacterMode("sheet");
  }

  function saveCharacter() {
    if (!draftCharacter) return;
    onUpdateAccount({
      ...account,
      characters: account.characters.map((character) => character.id === draftCharacter.id ? draftCharacter : character)
    });
    setSaveMessage("Ficha salva agora");
    window.setTimeout(() => setSaveMessage(""), 1800);
  }

  function discardCharacterChanges() {
    setDraftCharacter(selected);
  }

  function duplicateCharacter(id) {
    const source = account.characters.find((character) => character.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: makeId("character"),
      name: `${source.name || "Personagem"} copia`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onUpdateAccount({ ...account, characters: [copy, ...account.characters] });
    setSelectedId(copy.id);
    setActiveView("characters");
    setCharacterMode("sheet");
  }

  function deleteCharacter(id) {
    if (selectedId === id && hasDraftChanges && !window.confirm("Voce tem alteracoes nao salvas. Apagar mesmo assim?")) return;
    const nextCharacters = account.characters.filter((character) => character.id !== id);
    onUpdateAccount({ ...account, characters: nextCharacters });
    if (selectedId === id) setSelectedId(nextCharacters[0]?.id ?? null);
    if (!nextCharacters.length) setCharacterMode("list");
  }

  function selectCharacter(id) {
    if (id !== selectedId && hasDraftChanges && !window.confirm("Voce tem alteracoes nao salvas. Trocar de ficha e perder o rascunho?")) return;
    setSelectedId(id);
    setActiveView("characters");
    setCharacterMode("sheet");
  }

  function rollDie(sides) {
    const pendingRoll = {
      id: makeId("roll-pending"),
      sides,
      result: null,
      characterId: selected?.id ?? null,
      characterName: selected?.name ?? "",
      createdAt: new Date().toISOString(),
      rolling: true
    };
    setLastRoll(pendingRoll);

    window.setTimeout(() => {
      const result = Math.floor(Math.random() * sides) + 1;
      const createdAt = new Date().toISOString();
      const characterId = selected?.id ?? null;
      const characterName = selected?.name ?? "";
      const currentRolls = rollsFor(account);
      const roll = {
        id: makeId("roll"),
        sides,
        result,
        characterId,
        characterName,
        createdAt
      };
      setLastRoll(roll);
      onUpdateAccount({ ...account, rolls: [roll, ...currentRolls].slice(0, 80) });
    }, 850);
  }

  function updateMasterAccount(nextAccount) {
    onUpdateAccount(nextAccount);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="top-identity">
          <ProfilePhoto profile={profile} />
          <div>
            <p className="eyebrow">Fichario</p>
            <h1>Mesa de {profile.displayName}</h1>
          </div>
        </div>
        <div className="top-actions">
          <span>{account.characters.length} fichas</span>
          <button type="button" onClick={createCharacter}>Nova ficha</button>
          <button type="button" className="ghost" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="workspace">
        <div className={activeView === "home" ? "workspace-panel active" : "workspace-panel"}>
          <HomeView
            account={account}
            profile={profile}
            selected={selected}
            onOpenCharacters={() => {
              setActiveView("characters");
              setCharacterMode("list");
            }}
            onOpenSheet={() => {
              setActiveView("characters");
              setCharacterMode("sheet");
            }}
            onCreateCharacter={createCharacter}
          />
        </div>

        <div className={activeView === "characters" ? "workspace-panel active" : "workspace-panel"}>
          {characterMode === "list" ? (
            <CharacterList
              characters={account.characters}
              selectedId={selected?.id}
              onSelect={selectCharacter}
              onCreate={createCharacter}
              onDuplicate={duplicateCharacter}
              onDelete={deleteCharacter}
            />
          ) : (
            <>
              <button type="button" className="back-button" onClick={() => setCharacterMode("list")}>Voltar para personagens</button>
              <CharacterEditor
                character={draftCharacter}
                onChange={setDraftCharacter}
                onSave={saveCharacter}
                onDiscard={discardCharacterChanges}
                hasChanges={hasDraftChanges}
                saveMessage={saveMessage}
              />
            </>
          )}
        </div>

        <div className={activeView === "campaigns" ? "workspace-panel active" : "workspace-panel"}>
          <CampaignsView master={master} characters={account.characters} onUpdate={(nextMaster) => onUpdateAccount({ ...account, master: nextMaster })} />
        </div>

        <div className={activeView === "dice" ? "workspace-panel active" : "workspace-panel"}>
          <DicePanel selected={selected} rolls={rolls} onRoll={rollDie} />
        </div>

        <div className={activeView === "master" ? "workspace-panel active" : "workspace-panel"}>
          <MasterDesk account={account} master={master} onUpdate={updateMasterAccount} />
        </div>
      </div>

      <BottomNav activeView={activeView} onChange={setActiveView} />
      <FloatingDiceButton onClick={() => setActiveView("dice")} />
      <DiceModal roll={lastRoll} onClose={() => setLastRoll(null)} onRoll={rollDie} />
    </main>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [vault, setVault] = useState(loadVault);
  const [activeAccountId, setActiveAccountId] = useState(() => sessionStorage.getItem(SESSION_KEY));
  const [cloudSession, setCloudSession] = useState(null);
  const [cloudAccount, setCloudAccount] = useState(null);
  const [cloudMessage, setCloudMessage] = useState("");
  const saveTimer = useRef(null);
  const hydrationRun = useRef(0);
  const activeAccount = rpgCloudEnabled
    ? cloudAccount
    : vault.accounts.find((account) => account.id === activeAccountId);

  useEffect(() => {
    if (!rpgCloudEnabled) {
      const timer = window.setTimeout(() => setBooting(false), 420);
      return () => window.clearTimeout(timer);
    }

    let mounted = true;

    async function hydrate(session) {
      if (!mounted) return;
      const run = ++hydrationRun.current;
      setCloudSession(session);
      if (!session?.user) {
        setCloudAccount(null);
        setBooting(false);
        return;
      }

      const cacheKey = `${CLOUD_CACHE_PREFIX}${session.user.id}`;
      let cachedAccount = null;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedAccount = { ...JSON.parse(cached), id: session.user.id, email: session.user.email };
          setCloudAccount(cachedAccount);
          setBooting(false);
        } else {
          setBooting(true);
        }
      } catch {
        localStorage.removeItem(cacheKey);
        setBooting(true);
      }

      try {
        const user = session.user;
        const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Jogador";
        const localMatch = loadVault().accounts.find((account) => account.name.toLowerCase() === displayName.toLowerCase());
        const account = await loadPlayerAccount(user, () => localMatch
          ? { ...localMatch, id: user.id, email: user.email, password: undefined }
          : createAccount(displayName, user.id, user.email));
        if (!mounted || run !== hydrationRun.current) return;
        setCloudAccount(account);
        localStorage.setItem(cacheKey, JSON.stringify(account));
        setCloudMessage("");
      } catch {
        if (!mounted || run !== hydrationRun.current) return;
        setCloudMessage(cachedAccount
          ? "Nao foi possivel sincronizar agora. Seus dados locais continuam disponiveis."
          : "A conexao demorou demais. Tente entrar novamente.");
      } finally {
        if (mounted && run === hydrationRun.current) setBooting(false);
      }
    }

    getCurrentSession().then(hydrate).catch(() => {
      setCloudMessage("Nao foi possivel conectar ao Supabase.");
      setBooting(false);
    });
    const { data: { subscription } } = observeAuth(hydrate);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearTimeout(saveTimer.current);
    };
  }, []);

  function commit(nextVault) {
    setVault(nextVault);
    saveVault(nextVault);
  }

  function register(name, password) {
    const account = { ...createAccount(name), password: passwordHash(password) };
    commit({ accounts: [account, ...vault.accounts] });
    sessionStorage.setItem(SESSION_KEY, account.id);
    setActiveAccountId(account.id);
  }

  function login(accountId) {
    sessionStorage.setItem(SESSION_KEY, accountId);
    setActiveAccountId(accountId);
  }

  async function logout() {
    if (rpgCloudEnabled) {
      try {
        await signOutPlayer();
      } catch {
        setCloudMessage("Nao foi possivel encerrar a sessao agora.");
      }
      return;
    }
    sessionStorage.removeItem(SESSION_KEY);
    setActiveAccountId(null);
  }

  function updateAccount(nextAccount) {
    if (rpgCloudEnabled && cloudSession?.user) {
      setCloudAccount(nextAccount);
      localStorage.setItem(`${CLOUD_CACHE_PREFIX}${cloudSession.user.id}`, JSON.stringify(nextAccount));
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        savePlayerAccount(nextAccount, cloudSession.user.id).catch(() => {
          setCloudMessage("Alteracoes salvas neste aparelho; sincronizacao pendente.");
        });
      }, 450);
      return;
    }
    commit({
      accounts: vault.accounts.map((account) => account.id === nextAccount.id ? nextAccount : account)
    });
  }

  async function authenticateWithCloud(mode, credentials) {
    try {
      setCloudMessage("");
      if (mode === "login") {
        await signInPlayer(credentials);
        return { message: "" };
      }

      const data = await signUpPlayer(credentials);
      return data.session
        ? { message: "Conta criada. Bem-vindo a mesa!" }
        : { message: "Conta criada. Confira seu e-mail para confirmar o acesso." };
    } catch (error) {
      const messages = {
        "Invalid login credentials": "E-mail ou senha nao conferem.",
        "User already registered": "Este e-mail ja esta cadastrado.",
        "Email not confirmed": "Confirme seu e-mail antes de entrar."
      };
      return { message: messages[error.message] || "Nao foi possivel entrar. Tente novamente." };
    }
  }

  if (booting) return <LoadingScreen />;
  if (!activeAccount) return (
    <AuthScreen
      cloudEnabled={rpgCloudEnabled}
      vault={vault}
      onLogin={login}
      onRegister={register}
      onCloudAuth={authenticateWithCloud}
      cloudMessage={cloudMessage}
    />
  );
  return <Dashboard account={activeAccount} onLogout={logout} onUpdateAccount={updateAccount} />;
}
