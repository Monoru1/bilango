import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Row, Screen, SectionTitle, Text } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

interface Topic {
  title: string;
  body: string[];
}

const MANAGER_TOPICS: Topic[] = [
  {
    title: 'Faire le bilan du jour',
    body: [
      "Touchez « Faire le bilan du jour » sur l'accueil.",
      "Saisissez le chiffre d'affaires, les dépenses et les ajouts à la caisse en montant global. Pour plus de précision, touchez « Détailler (optionnel) » et ajoutez des lignes : le total se calcule seul.",
      "Les ajouts à la caisse (ex. un dépôt du propriétaire) ne sont pas du chiffre d'affaires : mettez-les dans leur propre case.",
      'Touchez « Envoyer le bilan ». Vous pouvez le modifier pendant 24 h.',
    ],
  },
  {
    title: 'Comprendre la caisse théorique',
    body: [
      "Au tout premier bilan, vous comptez l'argent dans la caisse et vous le déclarez, une seule fois.",
      'Ensuite, chaque jour : caisse de la veille + chiffre d\'affaires + ajouts à la caisse − dépenses.',
      "Plus vous déclarez fidèlement chaque mouvement d'argent, plus la caisse affichée correspond à la caisse réelle.",
    ],
  },
  {
    title: 'Modifier un bilan envoyé',
    body: [
      "Le bouton « Modifier » reste visible 24 h après l'envoi, avec l'heure limite.",
      "Le propriétaire peut consulter l'ancienne et la nouvelle version.",
    ],
  },
];

const OWNER_TOPICS: Topic[] = [
  {
    title: 'Lire le tableau de bord',
    body: [
      "Le gros chiffre est le chiffre d'affaires du jour. Tant qu'aucun bilan n'est arrivé, vous voyez le dernier bilan reçu avec sa date et le badge « En attente du bilan ».",
      "Plusieurs personnes peuvent envoyer un bilan le même jour : le chiffre du jour est la somme de tous. Touchez-le pour voir qui a rapporté quoi.",
      'Utilisez Aujourd\'hui / 7 jours / 30 jours pour changer de période.',
    ],
  },
  {
    title: 'Gérer les rôles et les permissions',
    body: [
      'Dans l\'onglet Équipe, créez vos rôles (Caissier, Gérant, Comptable…) et associez-les à un niveau : Saisie seule, Gestion complète ou Lecture seule.',
      "Invitez une personne avec son numéro : elle n'a accès qu'après avoir accepté l'invitation.",
      'Personne ne peut retirer ou modifier quelqu\'un de rang égal ou supérieur. Quand vous retirez quelqu\'un, ses bilans passés restent conservés.',
    ],
  },
  {
    title: 'Contrôler votre caisse',
    body: [
      "L'application ne signale aucun écart et n'accuse personne. Elle vous donne la caisse théorique : comptez l'argent réel, sans prévenir, et comparez.",
    ],
  },
  {
    title: 'Gérer plusieurs business',
    body: [
      "Touchez le menu en haut à gauche pour passer d'un business à l'autre, voir le chiffre du jour de chacun et ajouter un business.",
      'Un même compte peut être propriétaire de ses business et manager chez quelqu\'un d\'autre.',
    ],
  },
  {
    title: 'Gérer l\'abonnement',
    body: [
      "L'abonnement coûte 2 000 FCFA pour 30 jours, payés par Mobile Money (MTN ou Moov).",
      "Le lien de paiement vous est envoyé sur WhatsApp : l'application affiche seulement l'état de l'abonnement et les jours restants.",
      'Si vous payez avant la fin, les 30 jours s\'ajoutent à ceux qu\'il vous reste.',
    ],
  },
];

/** Aide intégrée, organisée par rôle (cahier §6.5). */
export default function HelpScreen() {
  return (
    <Screen>
      <SectionTitle>Si vous faites le bilan (manager / employé)</SectionTitle>
      {MANAGER_TOPICS.map((t) => (
        <Accordion key={t.title} topic={t} />
      ))}
      <SectionTitle>Si vous êtes propriétaire</SectionTitle>
      {OWNER_TOPICS.map((t) => (
        <Accordion key={t.title} topic={t} />
      ))}
    </Screen>
  );
}

function Accordion({ topic }: { topic: Topic }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={topic.title}
        onPress={() => setOpen((o) => !o)}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {topic.title}
          </Text>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
        </Row>
      </Pressable>
      {open ? (
        <View style={{ gap: spacing.sm }}>
          {topic.body.map((line, i) => (
            <Text key={i} tone="secondary">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
