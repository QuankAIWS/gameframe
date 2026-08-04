---
title: Monster Master RPG Lore and Story Decisions
status: developing
document_type: design
authority: owner-approved decisions
owner: Scribbles GameFrame
last_updated: 2026-08-04
applies_to:
  - Monster Master RPG
  - Monster Master: Arena Battles presentation
related:
  - shared/rpg-monster-master-reference-campaign.md
  - shared/rpg-media-theme-and-audio-pipeline.md
  - shared/rpg-rendering-and-asset-contract.md
  - monster-master-rules.md
---

# Monster Master RPG Lore and Story Decisions

This document records accepted Monster Master RPG fiction, tone, character, and world decisions as they are made. It is intentionally built one bounded decision at a time. Unselected alternatives and speculative lore do not become canon merely because they were discussed.

## Decision 1 — Product tone and player role

Monster Master is a funny fantasy-adventure world where monster training is an established profession.

The player character is a human trainer and a full party member, not a monster or an off-screen commander. Trainers have archetypes, abilities, equipment, social roles, and meaningful participation in exploration and tactical combat. Depending on archetype, a trainer may fight beside called monsters, strengthen them, use ranged magic, heal, control positioning, or specialize in calling and managing a roster.

Monsters are distinct companions and combatants that trainers can call into battle.

The comedy should be dry, situational, and frequently sardonic. The setting may contain danger, consequences, and sincere character moments, but it should not default to solemn mythological exposition, melodramatic fantasy terminology, constant slapstick, or self-aware parody.

### Implementation consequences

- Trainer and monster assets remain separate families.
- The current bootstrap presentation of the Master as a creature is not permanent lore.
- Future combat design must support active trainer archetypes rather than reducing every trainer to the same support unit.
- Future story and lore decisions should be presented in small, separately approvable slices.

## Decision 2 — Capture cubes and monster accommodations

Trainers capture, carry, and call monsters using capture cubes. A cube contains a private interior living space for its assigned monster rather than functioning as a cramped physical container.

Capture cubes have quality tiers. As a monster becomes stronger and more accomplished, it expects better accommodations. A neglected monster becomes increasingly irritated and may eventually refuse to leave its cube until its trainer provides an acceptable upgrade.

Entry-level cubes provide basic shelter. Premium cubes can contain extravagant customized residences. A high-level monster may reasonably demand a mansion, luxury furnishings, automated amenities, and unnecessary fixtures such as gold toilets.

Cube expectations create a recurring progression cost, relationship pressure, status symbol, and source of dry comedy. They should matter without becoming constant inventory maintenance.

### Implementation consequences

- Monster records need an assigned cube, cube tier, accommodation preference, and satisfaction state.
- Progression and economy design must include cube purchases or upgrades.
- Refusal to deploy is a possible consequence of severe accommodation neglect, not a random combat failure.
- Cube interiors can become character scenes, customization spaces, rewards, and visual assets.

## Decision 3 — Mixed capture rules

Capture depends on the monster's level of intelligence and agency.

Ordinary animal-like monsters can be captured through battle by weakening them and successfully containing them in a capture cube. Intelligent monsters cannot be legitimately captured this way. They must agree to enter the cube after negotiation, recruitment, payment, friendship, intimidation, defeat, or another story-appropriate arrangement.

Illegal capture cubes can override that consent. Their manufacture, sale, and use provide a straightforward criminal practice for antagonists and corrupt trainers without requiring every normal trainer to behave like a kidnapper.

### Implementation consequences

- Monster definitions need an intelligence or consent classification.
- Capture encounters must support both mechanical containment and dialogue-driven recruitment.
- Intelligent-monster recruitment may include explicit terms, costs, or expectations.
- Forced-capture cubes are contraband and can create legal, faction, and relationship consequences.

## Decision 4 — Monster intelligence

Monster intelligence is primarily species-based. Some species are animal-like, some possess roughly human-level intelligence, and some occupy a middle ground with limited language, unusual reasoning, or narrow but sophisticated abilities.

Rare individuals can fall outside their species norm. An ordinarily animal-like species may occasionally produce a fully intelligent individual, while an intelligent species can still include unusual developmental conditions or individuals who communicate poorly. These exceptions should be uncommon enough to remain notable rather than making every monster's classification unpredictable.

### Implementation consequences

- Species definitions establish the normal intelligence and consent classification.
- Individual monster records may override that default for authored exceptional characters.
- Exceptional intelligence can support discoveries, companions, legal disputes, and sardonic situations without erasing stable species expectations.
- Capture logic must use the individual's actual classification rather than blindly relying on species defaults.

## Decision 5 — Patchwork legal rights

Intelligent monsters are broadly recognized as persons, but their practical rights vary by kingdom, species, and local law.

Some jurisdictions allow intelligent monsters to own property, earn wages, sign contracts, travel independently, and bring legal complaints. Others restrict those rights, require a human sponsor, recognize only approved species, or bury the entire question under contradictory licensing rules.

A monster's legal status can therefore change while crossing a border even though its actual intelligence has not. This supports regional conflict and sardonic bureaucracy without making the setting uniformly cruel.

### Implementation consequences

- Regions need a compact policy describing intelligent-monster rights.
- Legal status may affect travel, employment, ownership, contracts, and access to public services.
- Trainers can act as representatives where required, but intelligent monsters are not automatically treated as their property.
- Stories can use rights disputes selectively rather than turning every session into legal administration.

## Decision 6 — Rare monster Masters

Intelligent monsters can become licensed Monster Masters and operate capture cubes, but this is uncommon, legally restricted, and socially unusual.

Some jurisdictions prohibit monster Masters entirely. Others require special licensing, a human sponsor, additional competency examinations, or species-specific approval. Even where legal, a monster commanding and housing other monsters attracts attention and may be treated as suspicious, prestigious, ridiculous, or all three at once.

Monster Masters should appear as notable NPCs and occasional player-character options rather than being commonplace.

### Implementation consequences

- Trainer identity cannot be hard-coded as human, even though humans remain the normal case.
- Character and licensing systems need an exceptional monster-Master path.
- Monster Masters can own capture cubes and maintain their own monster roster.
- Regional laws may impose additional restrictions or story complications on them.

## Decision 7 — Cube compatibility and legal gatekeeping

Monster Masters are rare for both practical and political reasons.

Capture cubes were originally designed around human hands, senses, magical tolerances, and control habits. Some intelligent monster species can use them normally, while others require adapted controls, custom interfaces, or expensive specialist cubes. A few species are genuinely poor candidates for safe cube operation.

Governments and licensing bodies use those real compatibility problems to justify restrictions far broader than the evidence supports. Requirements may include redundant testing, human sponsorship, species-specific permits, costly adapted equipment, and approval boards with little actual expertise.

### Implementation consequences

- Trainer species can affect cube-interface and equipment requirements without determining competence outright.
- Adapted capture cubes form a legitimate equipment category rather than a cosmetic distinction.
- Regional licensing restrictions should distinguish actual safety requirements from bureaucratic gatekeeping.
- Exceptional monster Masters can succeed through compatible anatomy, adapted equipment, unusual skill, or persistence through an unnecessarily hostile licensing process.

## Decision 8 — Tiered capture cube licensing

Capture cube ownership and use are regulated by tier rather than being restricted entirely to professional Monster Masters.

Basic domestic cubes are ordinary consumer products. People may use them to house approved household, working, or companion monsters without holding a full Master license.

Higher-risk activities require progressively higher licenses. These include capturing wild monsters, transporting dangerous species, maintaining larger rosters, operating adapted or high-capacity cubes, and entering organized combat.

Licensing standards vary by jurisdiction and are not always sensible. A person may legally own a cube containing an enormous docile grazing monster while needing three permits for a venomous creature the size of a shoe.

### Implementation consequences

- Cubes and activities need license-tier requirements rather than a single ownership flag.
- Basic domestic cube ownership must not automatically make a character a Monster Master.
- Wild capture, dangerous-species handling, roster capacity, and competitive battling can unlock through separate certifications.
- Regional law may alter requirements, fees, exemptions, and enforcement.

## Decision 9 — Monster-controlled exits and containment locks

Intelligent monsters can normally leave their own capture cubes without waiting for a trainer to release them. Animal-like monsters generally cannot operate the exit controls unless specially trained or provided with an adapted interface.

Exit permissions are not absolute. Lawful locking systems may be required in restricted public areas, medical quarantine, prisons, disaster response, or the relocation of dangerous monsters. Purpose-built relocation cubes prioritize secure containment over comfort and ordinary self-exit rights.

Cubes can also be illegally modified. Contraband overrides may prevent an intelligent monster from leaving, bypass legal safeguards, conceal the cube's actual occupant, or permit release where local systems have imposed a safety lock.

### Implementation consequences

- Cube records need exit-permission and containment-lock states.
- Intelligent monsters receive self-exit permission by default unless a lawful or illegal override is active.
- Restricted zones may temporarily impose certified containment requirements.
- Dangerous-monster relocation cubes are a distinct equipment category with stricter licensing and inspection.
- Illegal cube modifications can create rescue, smuggling, escape, and enforcement scenarios.
