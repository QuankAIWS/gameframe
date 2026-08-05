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
- The current bootstrap presentation of the player-side trainer as a creature is not permanent lore.
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

## Decision 6 — Rare nonhuman license holders

Intelligent monsters can hold capture-cube, handling, training, transport, and other professional license classes where local law permits, but this remains uncommon, legally restricted, and socially unusual.

Some jurisdictions prohibit intelligent monsters from holding particular license classes entirely. Others require a human sponsor, additional competency examinations, adapted equipment, or species-specific approval. Even where legal, an intelligent monster housing, directing, or transporting other monsters attracts attention and may be treated as suspicious, prestigious, ridiculous, or all three at once.

Licensed intelligent monsters should appear as notable NPCs and occasional player-character options rather than being commonplace.

### Implementation consequences

- License-holder identity cannot be hard-coded as human, even though humans remain the normal case.
- Character and licensing systems need an exceptional nonhuman applicant path.
- Licensed intelligent monsters can own cubes and maintain rosters according to their license classes.
- Regional laws may impose additional restrictions or story complications on them.

## Decision 7 — Cube compatibility and legal gatekeeping

Licensed intelligent-monster handlers remain uncommon for both practical and political reasons.

Capture cubes were originally designed around human hands, senses, magical tolerances, and control habits. Some intelligent monster species can use them normally, while others require adapted controls, custom interfaces, or expensive specialist cubes. A few species are genuinely poor candidates for safe cube operation.

Governments and licensing bodies use those real compatibility problems to justify restrictions far broader than the evidence supports. Requirements may include redundant testing, human sponsorship, species-specific permits, costly adapted equipment, and approval boards with little actual expertise.

### Implementation consequences

- Handler species can affect cube-interface and equipment requirements without determining competence outright.
- Adapted capture cubes form a legitimate equipment category rather than a cosmetic distinction.
- Regional licensing restrictions should distinguish actual safety requirements from bureaucratic gatekeeping.
- Exceptional nonhuman handlers can succeed through compatible anatomy, adapted equipment, unusual skill, or persistence through an unnecessarily hostile licensing process.

## Decision 8 — Tiered capture cube licensing

Capture cube ownership and use are regulated by license class rather than being restricted entirely to professional trainers or handlers.

Basic domestic cubes are ordinary consumer products. People may use them to house approved household, working, or companion monsters under a common low-tier license or registration class.

Higher-risk activities require progressively higher licenses. These include capturing wild monsters, transporting dangerous species, maintaining larger rosters, operating adapted or high-capacity cubes, professional training, and entering organized combat.

Licensing standards vary by jurisdiction and are not always sensible. A person may legally own a cube containing an enormous docile grazing monster while needing three permits for a venomous creature the size of a shoe.

### Implementation consequences

- Cubes and activities need license-class requirements rather than a single ownership flag.
- Basic domestic cube ownership must not automatically confer professional authority or Monster Master status.
- Wild capture, dangerous-species handling, roster capacity, professional training, and competitive battling can unlock through separate certifications.
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

## Decision 10 — Normal cube time with extremely rare ancient exceptions

Time passes normally inside ordinary capture cubes. Monsters sleep, eat, train, relax, become bored, and notice how long their trainer has left them inside. Cube quality therefore affects everyday life rather than providing consequence-free storage.

A very small number of ancient cubes run faster on the inside. Minutes outside can feel like hours to the occupant. These cubes are not ordinary premium upgrades or reproducible modern products. They are artifacts, closely guarded heirlooms, state secrets, unstable discoveries, or major campaign prizes.

Accelerated interior time does not suspend consequences. The occupant experiences the additional time, consumes food, becomes tired, can train, and may age according to the cube's actual behavior. Long use can therefore be valuable, miserable, or dangerous depending on the cube and its condition.

### Implementation consequences

- Ordinary cube occupants continue normal biological, social, and training schedules.
- Standard cube tiers must not include adjustable time rates.
- Ancient fast-time cubes require explicit authored records and fixed or unreliable time ratios.
- Food use, fatigue, training, aging, and psychological effects must follow experienced interior time unless a specific artifact establishes otherwise.
- Temporal cubes may carry serious defects, legal restrictions, ownership disputes, or maintenance requirements.

## Decision 11 — Generated staples and demanded real meals

Ordinary capture cubes can generate safe, nutritionally adequate basic food and water for their assigned monster. The generated diet prevents routine starvation and removes constant ration bookkeeping, but it is bland and should not count as proper care for every monster.

Monsters may have favorite foods, species-specific diets, allergies, cultural expectations, and increasingly expensive tastes. Stronger or higher-status monsters can demand real meals, preferred ingredients, imported snacks, private cooks, or food that does not arrive as the same beige nutritional brick every day.

Providing good food improves satisfaction and relationships. Repeatedly relying on cube staples when better care is expected can contribute to resentment and eventual refusal to deploy, especially for intelligent monsters capable of filing a detailed complaint.

### Implementation consequences

- Cubes need a basic food-generation capability and supported-diet classification.
- Monster records need diet requirements, preferences, and food-satisfaction state.
- Special meals can function as supplies, gifts, quest rewards, relationship actions, and cube upgrades.
- Basic generated food prevents starvation but does not automatically satisfy comfort, morale, or contractual expectations.
- Fast-time cubes consume food according to experienced interior time, making their use materially expensive.

## Decision 12 — Reverse-engineered capture cube technology

Modern capture cubes are mass-produced descendants of much older cube technology. Present-day engineers can manufacture reliable basic cubes because generations of craftspeople, scholars, and manufacturers have reverse-engineered repeatable portions of ancient designs.

Modern cubes are cheaper, safer, easier to repair, and generally less capable than intact ancient examples. Their makers understand enough to reproduce standard interiors, containment, calling, food generation, and common upgrades, but not the deepest principles that make the technology work.

Ancient cubes may contain functions that modern manufacturers cannot duplicate, including accelerated interior time, unusually large spaces, self-repair, strange environmental controls, or systems whose purpose is no longer understood. Not every ancient cube is superior; some are damaged, dangerous, badly documented, or designed for purposes that modern people would find inconvenient.

### Implementation consequences

- Cube definitions need an origin category such as modern, reverse-engineered premium, ancient, or experimental.
- Modern cube progression should improve comfort and reliability without casually reproducing unique ancient functions.
- Ancient cubes can serve as discoveries, campaign prizes, research subjects, inheritance disputes, and sources of dangerous defects.
- Manufacturers, governments, and criminal groups have reasons to search for intact ancient cubes and lost design fragments.

## Decision 13 — Disputed ancient origin

Nobody has proved who created the original capture cubes. Lost human empires, ancient intelligent-monster civilizations, vanished mixed societies, religious orders, and several modern states all claim some connection to the technology.

The surviving evidence is contradictory. Different ancient cubes use incompatible markings, materials, interfaces, and construction methods. This may indicate several makers, regional variants, later modifications, deliberate misinformation, or one civilization changing substantially over time.

Competing origin claims have political and commercial value. Museums, governments, universities, manufacturers, and species-rights movements may promote whichever interpretation best supports their authority, funding, ownership claims, or preferred version of history.

The setting should preserve this uncertainty unless a specific campaign deliberately discovers stronger evidence. Even then, one discovery need not explain every ancient cube.

### Implementation consequences

- Ancient-cube records may carry competing provenance theories rather than one canonical maker.
- Visual and mechanical variation among ancient cubes is expected rather than treated as an inconsistency.
- Factions can dispute excavation rights, ownership, cultural inheritance, and publication of evidence.
- No implementation identifier should silently encode one origin theory as established fact.

## Decision 14 — Graduated travel danger and human threats

Travel danger increases as civilization becomes thinner. Major settled roads are patrolled, maintained, and generally safe from serious wild-monster attacks. Frontier roads are less reliable, and true wilderness can be extremely dangerous due to territorial monsters, predators, hostile terrain, severe weather, ruins, and the absence of quick assistance.

A safe road is not a harmless road. Travelers can still encounter bandits, thieves, fraudulent toll collectors, dishonest guides, crooked merchants, confidence schemes, staged emergencies, cube theft, and ambushes arranged by people who understand exactly how much equipment a licensed trainer or high-tier handler is carrying.

Towns and cities have their own threats. Pickpockets, burglars, black-market cube dealers, corrupt officials, swindlers, organized theft rings, and predatory businesses can create trouble without involving a wild monster. Human criminals should remain genuine threats rather than always being disguises, servants, or victims of monsters.

The setting should support ordinary commerce and travel without making every journey a constant battle. Danger is contextual, and many threats should be avoidable through preparation, judgment, reputation, local knowledge, or social play.

### Implementation consequences

- Routes and regions need a travel-danger classification tied to settlement, patrol coverage, terrain, and monster activity.
- Encounter generation must include monster, human, social, criminal, and environmental threats.
- Towns need local crime and corruption profiles rather than being automatically safe zones.
- Security, reputation, licenses, guides, and local knowledge can alter encounter likelihood or available responses.
- Low-danger travel should still permit scams, theft, complications, and character scenes without forcing combat.

## Decision 15 — Layered law enforcement

Law enforcement is divided among several institutions rather than handled by one universal force.

Town and city guards handle ordinary crime, public disorder, theft, fraud, local warrants, and immediate threats inside their jurisdiction. Their competence, funding, integrity, and authority vary substantially by settlement.

Road patrols protect major routes, investigate banditry and fraudulent toll operations, escort dangerous shipments, maintain warning posts, and respond to incidents between settlements. Remote routes may receive irregular coverage or none at all.

Licensed wardens are specialists responsible for dangerous monsters, unlawful capture, forced-capture cubes, containment failures, prohibited species, serious cube modifications, and incidents beyond the capacity of ordinary guards. Wardens may be national, regional, contracted, or attached to a licensing authority depending on the jurisdiction.

These groups can cooperate, compete, pass responsibility to one another, or argue over jurisdiction while the actual problem becomes worse.

### Implementation consequences

- Settlements and regions need separate guard, road-patrol, and warden presence or response ratings.
- Crimes and incidents should identify which authority normally has jurisdiction.
- Local guards are not expected to solve every dangerous-monster emergency.
- Wardens need specialist training, equipment, legal powers, and recognizable roles distinct from ordinary guards.
- Corruption, poor funding, jurisdiction disputes, and delayed responses can create scenarios without making every authority institutionally evil.

## Decision 16 — Tiered emergency duty

Basic domestic cube owners and low-tier nonprofessional handlers have no standing legal duty to answer emergencies merely because they own a cube or live with a monster.

Licensed professional trainers and higher-tier handlers accept limited public-service obligations as part of certain license classes. During a credible emergency, authorized guards, road patrols, wardens, or other designated officials may request—and where local law permits, direct—a qualified license holder to provide reasonable assistance within the limits of that person's training, equipment, roster, physical condition, and license.

The obligation is not unlimited. A handler is not required to knowingly sacrifice themselves or their companions, obey an obviously unqualified or unlawful order, permanently surrender a monster, or perform work materially beyond their licensed competence. Intelligent monsters retain their own agency and cannot be compelled solely because their handler received an order.

Emergency service should normally include compensation, medical care, equipment-loss reimbursement, and legal protection for reasonable actions taken in good faith. Jurisdictions vary in how reliably they provide these benefits, and misuse of emergency authority can create disputes, corruption, debt, and story complications.

### Implementation consequences

- License classes need explicit emergency-duty scopes and exemptions.
- Emergency requests must identify the issuing authority, legal basis, compensation, expected task, and acceptable refusal conditions.
- Handler and monster condition, competence, consent, and equipment can limit required assistance.
- Domestic ownership must not create hidden public-service obligations.
- Emergency service can generate rewards, claims, injuries, damaged equipment, reputation changes, and later disputes over reimbursement.

## Decision 17 — Limited emergency detention authority

A professional training or handling license does not grant general police, investigative, or arrest powers.

Qualified license holders may intervene to stop an immediate threat, defend themselves or others, prevent an active theft or unlawful capture, recover a cube or occupant during an incident, and temporarily restrain a suspected offender when reasonably necessary to prevent escape or further harm until the proper authority arrives.

That authority ends when the immediate danger and credible flight risk are controlled. License holders cannot conduct routine searches, interrogations, raids, punishment, debt collection, or seizure of unrelated property unless they hold a separate office or receive explicit lawful deputization.

Any force used must be proportionate to the threat. Called monsters operate under the same limits, and an intelligent monster is not required to participate merely because its handler chooses to intervene. Suspects, evidence, and recovered property should be transferred promptly to guards, road patrols, or wardens.

Bad-faith detention, excessive force, fabricated evidence, or using the rule to settle private disputes can create criminal, civil, reputational, and licensing consequences. Local law may provide broader citizen-arrest rules, but a monster-related license does not turn its holder into law enforcement.

### Implementation consequences

- Appropriate higher-tier licenses need narrow emergency-intervention permissions distinct from police authority.
- Encounters must distinguish active threats from retrospective investigation or private retaliation.
- Temporary restraint needs duration, transfer, reporting, evidence-preservation, and force-proportionality rules.
- Deputization or separate employment can grant broader authority without changing the default licensed role.
- Abuse of detention authority can affect licenses, reputation, legal exposure, and relationships with companions.

## Decision 18 — License classes, qualification paths, and the Monster Master title

Most people who legally own, house, transport, train, battle with, or work alongside monsters hold a license or registration of one class or another. A basic domestic license is commonplace; specialized work requires additional classes for activities such as wild capture, commercial transport, dangerous-species handling, professional training, organized battle, research, medical care, or warden service.

A trainer is an ordinary profession and character role. Handler is the broad term for a person responsible for monsters under any relevant license class. Neither term implies legendary status.

Monster Master is not the ordinary name for a licensed professional and is not automatically granted by any routine license. A Monster Master is a legendary figure recognized as having exceptional mastery of monsters. The title should be rare enough that meeting one is notable, and holding several advanced licenses does not by itself make someone a Monster Master.

People can qualify for ordinary license classes through multiple routes. Accepted paths may include formal academies, apprenticeship under licensed professionals, military or warden training, guild instruction, regional programs, or independent study followed by a challenge examination. Regardless of route, applicants must pass the examinations, practical demonstrations, and field assessments required for the specific class.

Intelligent monsters may pursue the same routes where local law permits, subject to the compatibility and gatekeeping rules already established.

### Implementation consequences

- Licensing must be modeled as a set of classes and certifications rather than a single Master rank.
- Character records need separate profession, license-class, authority, and reputation fields.
- Monster Master status must be distinct from licenses and must never be inferred merely from owning cubes or passing exams.
- UI, dialogue, and code should use trainer, handler, license holder, specialist, or the specific profession unless legendary Monster Master status is actually intended.
- Background selection can support academy, apprenticeship, military, warden, guild, and self-taught qualification routes while sharing class-specific competency gates.

## Decision 19 — Monster Master as an earned reputation

No government, guild, academy, licensing authority, tournament body, or council has the power to officially create a Monster Master.

The title emerges through reputation, history, and broad public recognition after extraordinary accomplishments involving monsters. Those accomplishments may include unmatched training, exceptional bonds across many species, major discoveries, resolving disasters, defeating legendary threats, changing accepted practice, or achieving feats that ordinary license holders cannot plausibly imitate.

Recognition does not need to be unanimous. Different regions, cultures, professions, and monster communities may disagree about whether someone deserves the title. A person can be treated as a Monster Master in one kingdom and as an overrated celebrity, dangerous fraud, or obscure foreign specialist somewhere else.

Organizations may award honors, publish rankings, erect statues, or publicly proclaim someone a Monster Master, but those acts only influence reputation. They do not make the title authoritative, and official attempts to manufacture one can fail embarrassingly.

A person may become recognized during life or only after death. Claiming the title for oneself is generally considered boastful and does not make it true.

### Implementation consequences

- Monster Master recognition must be reputation-driven and separate from licenses, offices, levels, and tournament ranks.
- No single institution or numeric threshold can automatically grant or revoke the title.
- Recognition may vary by faction, region, profession, species community, and historical period.
- NPC dialogue and social reactions should reflect disputed or partial recognition.
- False claims can create ridicule, fraud disputes, or reputational consequences without making the words themselves universally illegal.

## Decision 20 — Mythically rare nonhuman Monster Masters

Any intelligent person can, in principle, become recognized as a Monster Master. The legendary reputation is not limited to humans and does not depend on species, anatomy, citizenship, or which license classes local governments are willing to issue.

A nonhuman Monster Master is nevertheless mythically rare. Most cultures know of none, one disputed ancient example, or a small number of figures whose stories have become difficult to separate from legend. A confirmed living example should feel like a once-in-an-era occurrence rather than an uncommon career achievement.

The rarity follows from several pressures acting together: intelligent monster license holders are already uncommon, legal and technical barriers limit their opportunities, public histories often minimize nonhuman accomplishments, and earning Monster Master recognition requires achievements far beyond ordinary professional excellence.

Species communities may preserve accounts ignored or dismissed by human institutions. A figure considered fictional by a kingdom's scholars may be remembered through detailed oral history, monuments, inherited obligations, or living witnesses among long-lived monsters.

### Implementation consequences

- Monster Master recognition cannot require a human species identifier.
- Nonhuman Monster Masters should be individually authored legendary figures, not generated as routine high-level NPCs.
- Historical records may contain disputed, suppressed, mistranslated, or species-specific accounts of such figures.
- A living nonhuman Monster Master should materially affect regional politics, scholarship, monster communities, and public expectations.
- Player characters may theoretically earn this recognition, but it must remain an exceptional long-form outcome rather than a normal progression tier.

## Decision 21 — A small handful of living Monster Masters

Only a small handful of living people are broadly recognized as Monster Masters across the world. The setting should generally contain fewer than ten widely accepted living figures, with several disputed or regional candidates around the edges.

The broadly recognized Monster Masters are famous names among professional trainers, handlers, wardens, scholars, rulers, and intelligent-monster communities. Ordinary people may know simplified stories, titles, or exaggerated versions of their accomplishments even when they could not identify every specialist involved.

Recognition remains decentralized. Lists published by academies, tournament organizations, governments, newspapers, and monster communities will not match perfectly. One figure may be accepted almost everywhere, another only across several kingdoms, and another may be considered a fraud by half the world despite achievements nobody can easily explain away.

A living nonhuman Monster Master, if one currently exists, is included within this same small global handful and remains an exceptional once-in-an-era figure rather than an additional common category.

### Implementation consequences

- The global setting should maintain a deliberately small authored roster of living Monster Masters rather than procedurally generating them.
- Widely recognized, regionally recognized, disputed, retired, missing, and presumed-dead states should remain distinct.
- Recognition data should record supporting regions, factions, species communities, and major accomplishments rather than a universal boolean alone.
- Introducing, killing, discrediting, or confirming a Monster Master should be a major world event.
- New legendary figures should not be added casually merely to populate high-level content.

## Decision 22 — Mixed public lives among Monster Masters

Living Monster Masters do not share one profession, allegiance, or relationship with public life. Their legendary reputation describes extraordinary mastery and accomplishments, not a standardized office.

Some are highly visible figures who run academies, advise rulers, lead expeditions, command specialist organizations, participate in diplomacy, publish research, or appear at major tournaments. Others have retired, withdrawn into remote territory, disappeared during an expedition, severed ties with institutions, become fugitives, entered criminal life, or are widely presumed dead despite unresolved sightings.

Public recognition does not guarantee virtue, political authority, reliability, or accessibility. A celebrated Monster Master may be vain, compromised, incompetent outside a narrow specialty, or unwilling to help. A criminal or enemy of the state may still remain a genuine Monster Master if the accomplishments behind the reputation are real.

The small living roster should therefore represent sharply different relationships to society rather than functioning as a uniform council of benevolent mentors.

### Implementation consequences

- Each living Monster Master needs independently authored public status, occupation, allegiance, legal status, accessibility, and current activity.
- Monster Master recognition must not automatically grant command authority, immunity, government office, or heroic alignment.
- Public, retired, isolated, missing, criminal, and presumed-dead states can produce different encounter and campaign structures.
- Institutions may seek endorsement, service, custody, testimony, or control of individual Monster Masters without speaking for the group as a whole.
- Bringing multiple living Monster Masters together should be unusual and politically significant rather than a routine meeting format.
