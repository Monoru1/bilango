import { homeColors } from './theme';

/**
 * En-tête commun à toute l'application : fond blanc, texte quasi noir (direction visuelle client,
 * fond général #FFFFFF, accent de marque limité). Une seule couleur d'en-tête garantit que les
 * icônes sombres de la barre d'état restent lisibles sur tous les écrans.
 */
export const headerOptions = {
  headerStyle: { backgroundColor: homeColors.background },
  headerTintColor: homeColors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: homeColors.text },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};
