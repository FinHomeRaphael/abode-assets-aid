/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://ptcuiawjfhvgnubpathd.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisez votre mot de passe FinHome</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={logoContainer}>
          <Img src={LOGO_URL} alt="FinHome" style={logo} />
        </div>
        <div style={card}>
          <Heading style={h1}>Mot de passe oublié ? 🔑</Heading>
          <div style={divider} />
          <Text style={text}>
            Vous avez demandé à réinitialiser votre mot de passe FinHome. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
          </Text>
          <div style={buttonContainer}>
            <Button style={button} href={confirmationUrl}>
              Réinitialiser le mot de passe
            </Button>
          </div>
        </div>
        <Text style={footer}>
          Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.
        </Text>
        <Text style={copyright}>© 2026 FinHome · Gestion de finances familiales</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '520px', margin: '0 auto', padding: '40px 24px' }
const logoContainer = { textAlign: 'center' as const, marginBottom: '32px' }
const logo = { height: '48px', width: 'auto', margin: '0 auto' }
const card = { background: '#f8fafb', border: '1px solid #e8eeef', borderRadius: '12px', padding: '32px', marginBottom: '24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1c2127', margin: '0 0 8px', textAlign: 'center' as const }
const divider = { width: '40px', height: '3px', background: '#4d9e8e', margin: '16px auto 20px', borderRadius: '2px' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px', textAlign: 'center' as const }
const buttonContainer = { textAlign: 'center' as const, margin: '24px 0 0' }
const button = { backgroundColor: '#4d9e8e', color: '#f0faf5', fontSize: '15px', fontWeight: '600' as const, borderRadius: '8px', padding: '14px 32px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const, lineHeight: '1.5', margin: '0 0 8px' }
const copyright = { fontSize: '11px', color: '#d1d5db', textAlign: 'center' as const, margin: '16px 0 0' }
