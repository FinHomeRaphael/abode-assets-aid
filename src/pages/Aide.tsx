import React from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, CreditCard, Target, PiggyBank, Landmark, Lightbulb, BarChart3, MessageSquare, Users, Settings } from 'lucide-react';

const Section = ({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) => (
  <Card className="mb-4">
    <CardHeader className="pb-2">
      <CardTitle className="text-base flex items-center gap-2">
        <span>{emoji}</span> {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
      {children}
    </CardContent>
  </Card>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{n}</span>
    <p>{children}</p>
  </div>
);

const Aide = () => {
  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Centre d'aide</h1>
          <p className="text-sm text-muted-foreground mt-1">Tout ce qu'il faut savoir pour bien utiliser l'application.</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
            <TabsTrigger value="general" className="text-xs gap-1"><Home className="w-3.5 h-3.5" />Général</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs gap-1"><CreditCard className="w-3.5 h-3.5" />Transactions</TabsTrigger>
            <TabsTrigger value="budgets" className="text-xs gap-1"><Target className="w-3.5 h-3.5" />Budgets</TabsTrigger>
            <TabsTrigger value="comptes" className="text-xs gap-1"><PiggyBank className="w-3.5 h-3.5" />Comptes</TabsTrigger>
            <TabsTrigger value="dettes" className="text-xs gap-1"><Landmark className="w-3.5 h-3.5" />Dettes</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1"><Lightbulb className="w-3.5 h-3.5" />Insights</TabsTrigger>
            <TabsTrigger value="foyer" className="text-xs gap-1"><Users className="w-3.5 h-3.5" />Foyer</TabsTrigger>
            <TabsTrigger value="profil" className="text-xs gap-1"><Settings className="w-3.5 h-3.5" />Profil</TabsTrigger>
          </TabsList>

          {/* GÉNÉRAL */}
          <TabsContent value="general" className="mt-4 space-y-4">
            <Section emoji="👋" title="Bienvenue">
              <p>Cette application vous permet de gérer vos finances personnelles et familiales : transactions, budgets, comptes bancaires, dettes et bien plus.</p>
              <p>Naviguez entre les sections grâce au menu en bas (mobile) ou en haut (desktop). Le bouton <strong>+</strong> au centre vous permet d'ajouter rapidement des éléments.</p>
            </Section>
            <Section emoji="🔄" title="Vue personnelle vs Foyer">
              <p>Utilisez le <strong>toggle Personnel / Foyer</strong> en haut de l'écran pour basculer entre :</p>
              <Step n={1}>Vue <strong>Personnelle</strong> : uniquement vos données (transactions, budgets, comptes créés par vous).</Step>
              <Step n={2}>Vue <strong>Foyer</strong> : les données partagées de tout le foyer.</Step>
            </Section>
            <Section emoji="📅" title="Sélecteur de mois">
              <p>La plupart des vues affichent les données du mois en cours. Utilisez les <strong>flèches gauche/droite</strong> à côté du mois pour naviguer entre les mois et consulter vos historiques.</p>
            </Section>
            <Section emoji="💱" title="Multi-devises">
              <p>L'application supporte plusieurs devises (CHF, EUR, USD…). Chaque compte et transaction peut avoir sa propre devise, et les montants sont automatiquement convertis dans la devise de référence de votre foyer.</p>
            </Section>
          </TabsContent>

          {/* TRANSACTIONS */}
          <TabsContent value="transactions" className="mt-4 space-y-4">
            <Section emoji="➕" title="Ajouter une transaction">
              <Step n={1}>Appuyez sur le bouton <strong>+</strong> puis sélectionnez <strong>Transaction</strong>.</Step>
              <Step n={2}>Choisissez le type : <strong>Dépense</strong> ou <strong>Revenu</strong>.</Step>
              <Step n={3}>Remplissez le libellé, le montant, la catégorie et la date.</Step>
              <Step n={4}>Optionnel : sélectionnez un compte bancaire, ajoutez des notes.</Step>
              <Step n={5}>Appuyez sur <strong>Enregistrer</strong>.</Step>
            </Section>
            <Section emoji="📸" title="Scanner un ticket">
              <Step n={1}>Appuyez sur <strong>+</strong> puis <strong>Scanner un ticket</strong>.</Step>
              <Step n={2}>Prenez une photo ou importez une image de votre ticket de caisse.</Step>
              <Step n={3}>L'IA analyse le ticket et pré-remplit automatiquement les informations (montant, catégorie, etc.).</Step>
              <Step n={4}>Vérifiez et validez les données avant d'enregistrer.</Step>
            </Section>
            <Section emoji="🔁" title="Transactions récurrentes">
              <p>Lors de la création d'une transaction, activez l'option <strong>Récurrente</strong> pour qu'elle se répète automatiquement chaque mois (loyer, salaire, abonnements, etc.).</p>
              <p>Vous pouvez définir un mois de début et un mois de fin optionnel.</p>
            </Section>
            <Section emoji="🔍" title="Filtrer et rechercher">
              <p>Sur la page Transactions, utilisez la <strong>barre de recherche</strong> pour filtrer par libellé. Vous pouvez aussi filtrer par <strong>catégorie</strong>, <strong>type</strong> (dépense/revenu) et <strong>compte</strong>.</p>
            </Section>
            <Section emoji="📥" title="Importer un relevé CSV">
              <p>Vous pouvez importer vos relevés bancaires au format CSV. L'application détecte automatiquement les colonnes et catégorise vos transactions grâce à l'IA.</p>
            </Section>
          </TabsContent>

          {/* BUDGETS */}
          <TabsContent value="budgets" className="mt-4 space-y-4">
            <Section emoji="🎯" title="Créer un budget">
              <Step n={1}>Allez dans l'onglet <strong>Budgets</strong> ou appuyez sur <strong>+</strong> → <strong>Budget</strong>.</Step>
              <Step n={2}>Choisissez une <strong>catégorie</strong> de dépense (Alimentation, Transport, etc.).</Step>
              <Step n={3}>Définissez le <strong>montant limite</strong> mensuel.</Step>
              <Step n={4}>Optionnel : activez les <strong>alertes</strong> pour être notifié quand vous approchez de la limite.</Step>
            </Section>
            <Section emoji="📊" title="Suivre ses budgets">
              <p>Chaque budget affiche une <strong>barre de progression</strong> indiquant combien vous avez dépensé par rapport à votre limite.</p>
              <p>Les couleurs changent automatiquement :</p>
              <Step n={1}><strong>Vert</strong> : vous êtes dans les clous (moins de 75%).</Step>
              <Step n={2}><strong>Orange</strong> : attention, vous approchez de la limite (75-100%).</Step>
              <Step n={3}><strong>Rouge</strong> : budget dépassé !</Step>
            </Section>
            <Section emoji="🔄" title="Budgets récurrents">
              <p>Les budgets peuvent être <strong>récurrents</strong> (se renouvellent chaque mois) ou <strong>ponctuels</strong> (valables pour un seul mois).</p>
            </Section>
          </TabsContent>

          {/* COMPTES BANCAIRES */}
          <TabsContent value="comptes" className="mt-4 space-y-4">
            <Section emoji="🏦" title="Ajouter un compte">
              <Step n={1}>Allez dans <strong>Comptes bancaires</strong> ou appuyez sur <strong>+</strong> → <strong>Compte</strong>.</Step>
              <Step n={2}>Donnez un <strong>nom</strong> au compte (ex: "Compte courant BNP").</Step>
              <Step n={3}>Choisissez le <strong>type</strong> : Courant, Épargne, Espèces, etc.</Step>
              <Step n={4}>Indiquez le <strong>solde initial</strong> et la <strong>devise</strong>.</Step>
            </Section>
            <Section emoji="💰" title="Objectifs d'épargne">
              <Step n={1}>Appuyez sur <strong>+</strong> → <strong>Compte épargne</strong>.</Step>
              <Step n={2}>Définissez un <strong>nom</strong> (ex: "Vacances"), un <strong>objectif</strong> et une <strong>date cible</strong> optionnelle.</Step>
              <Step n={3}>Ajoutez des <strong>dépôts</strong> régulièrement pour suivre votre progression.</Step>
            </Section>
            <Section emoji="🔀" title="Transferts entre comptes">
              <p>Vous pouvez effectuer des <strong>transferts</strong> entre vos comptes directement depuis la page d'un compte. Cela crée automatiquement les transactions correspondantes.</p>
            </Section>
          </TabsContent>

          {/* DETTES */}
          <TabsContent value="dettes" className="mt-4 space-y-4">
            <Section emoji="💸" title="Ajouter une dette">
              <Step n={1}>Allez dans <strong>Dettes</strong> ou appuyez sur <strong>+</strong> → <strong>Dette</strong>.</Step>
              <Step n={2}>Choisissez le <strong>type</strong> : Hypothèque, Prêt auto, Crédit conso, Leasing, etc.</Step>
              <Step n={3}>Renseignez le montant, le taux d'intérêt, la durée et la mensualité.</Step>
              <Step n={4}>L'application génère automatiquement un <strong>tableau d'amortissement</strong>.</Step>
            </Section>
            <Section emoji="📋" title="Tableau d'amortissement">
              <p>Chaque dette dispose d'un tableau détaillé montrant pour chaque échéance :</p>
              <Step n={1}>Le <strong>capital restant</strong> avant et après paiement.</Step>
              <Step n={2}>La part de <strong>capital</strong> et d'<strong>intérêts</strong> dans chaque mensualité.</Step>
              <Step n={3}>Le <strong>statut</strong> de chaque paiement (payé, en attente, en retard).</Step>
            </Section>
            <Section emoji="✏️" title="Modifier un paiement">
              <p>Vous pouvez <strong>personnaliser</strong> un paiement spécifique (par exemple si vous avez fait un remboursement anticipé). L'application recalcule automatiquement les échéances suivantes.</p>
            </Section>
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights" className="mt-4 space-y-4">
            <Section emoji="📈" title="Graphiques et analyses">
              <p>La page <strong>Insights</strong> vous offre une vue d'ensemble de vos finances avec des graphiques interactifs :</p>
              <Step n={1}><strong>Répartition des dépenses</strong> par catégorie (camembert).</Step>
              <Step n={2}><strong>Évolution</strong> des revenus et dépenses mois par mois.</Step>
              <Step n={3}><strong>Tendances</strong> et comparaisons avec les mois précédents.</Step>
            </Section>
            <Section emoji="🏥" title="Score de santé financière">
              <p>Votre <strong>Health Score</strong> est calculé automatiquement sur 100 points, basé sur :</p>
              <Step n={1}><strong>Taux d'épargne</strong> : combien vous épargnez par rapport à vos revenus.</Step>
              <Step n={2}><strong>Respect des budgets</strong> : pourcentage de budgets non dépassés.</Step>
              <Step n={3}><strong>Ratio d'endettement</strong> : poids des dettes vs revenus.</Step>
              <Step n={4}><strong>Fonds d'urgence</strong> : avez-vous assez d'épargne pour couvrir plusieurs mois.</Step>
            </Section>
            <Section emoji="✨" title="Conseiller IA">
              <p>Le <strong>Conseiller IA</strong> analyse vos données financières et vous donne des conseils personnalisés. Accédez-y via le bouton <strong>+</strong> → <strong>Conseiller IA</strong> ou depuis la page Insights.</p>
            </Section>
          </TabsContent>

          {/* FOYER */}
          <TabsContent value="foyer" className="mt-4 space-y-4">
            <Section emoji="👨‍👩‍👧‍👦" title="Gestion du foyer">
              <p>L'application fonctionne autour du concept de <strong>foyer</strong>. Un foyer peut contenir un ou plusieurs membres qui partagent leurs finances.</p>
            </Section>
            <Section emoji="📩" title="Inviter un membre">
              <Step n={1}>Allez dans votre <strong>Profil</strong>.</Step>
              <Step n={2}>Dans la section <strong>Membres du foyer</strong>, appuyez sur <strong>Inviter</strong>.</Step>
              <Step n={3}>Entrez l'<strong>adresse e-mail</strong> de la personne à inviter.</Step>
              <Step n={4}>La personne recevra un e-mail d'invitation et pourra rejoindre votre foyer lors de son inscription.</Step>
            </Section>
            <Section emoji="🔐" title="Données personnelles vs partagées">
              <p>Chaque élément (transaction, budget, compte) peut être <strong>personnel</strong> ou <strong>foyer</strong>. Les éléments personnels ne sont visibles que par vous, tandis que les éléments foyer sont partagés avec tous les membres.</p>
            </Section>
          </TabsContent>

          {/* PROFIL */}
          <TabsContent value="profil" className="mt-4 space-y-4">
            <Section emoji="👤" title="Mon profil">
              <p>Depuis la page <strong>Profil</strong>, vous pouvez :</p>
              <Step n={1}>Modifier votre <strong>prénom</strong> et <strong>nom</strong>.</Step>
              <Step n={2}>Changer la <strong>devise par défaut</strong> de votre foyer.</Step>
              <Step n={3}>Gérer les <strong>membres</strong> de votre foyer.</Step>
              <Step n={4}>Voir et gérer votre <strong>abonnement</strong>.</Step>
            </Section>
            <Section emoji="💎" title="Abonnement Premium">
              <p>L'abonnement Premium débloque des fonctionnalités avancées :</p>
              <Step n={1}>Accès aux <strong>Dettes</strong> et au tableau d'amortissement.</Step>
              <Step n={2}>Page <strong>Insights</strong> complète avec tous les graphiques.</Step>
              <Step n={3}><strong>Conseiller IA</strong> illimité.</Step>
              <Step n={4}><strong>Scanner de tickets</strong> illimité.</Step>
            </Section>
            <Section emoji="🚪" title="Déconnexion">
              <p>Appuyez sur le bouton <strong>Se déconnecter</strong> en bas de la page Profil pour vous déconnecter de votre compte.</p>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Aide;
