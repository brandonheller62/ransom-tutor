import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../LegalPage";
import { LEGAL_CONTACT_EMAIL, MIN_AGE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Ransom Tutor",
  description: "What Ransom Tutor collects, why, who it is shared with, and your choices.",
};

// Keep this in step with what the code actually does. If data handling changes
// (a new table, provider, or analytics), update this page and bump LEGAL_VERSION.
export default function PrivacyPage() {
  const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Privacy Policy" other={{ href: "/terms", label: "Terms of Use" }}>
      <p>
        Ransom Tutor is an AI study tool built as a student project for the AI Innovation
        Fellowship at Ransom Everglades School. It is run by its student developer, not by the
        school. This policy explains what we collect when you use it, why, and what you can do
        about it. In short: we collect what the tutor needs to work and to save your progress,
        we never sell it, and we don&apos;t show ads or track you around the web.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details.</strong> Your email address and password. Passwords are
          stored hashed by our authentication provider; we never see them in plain text.
        </li>
        <li>
          <strong>Your chats.</strong> Everything you type to the tutor, its replies, and any
          images you attach (for example, a photo of your handwritten work), along with the
          course, unit, mode, and difficulty of each chat.
        </li>
        <li>
          <strong>Practice quiz answers.</strong> Your free-response answers and attached photos
          are sent to the AI for grading. They are not saved after grading; only your totals
          are (see the next item).
        </li>
        <li>
          <strong>Progress.</strong> Problems attempted and solved, hints used, mastery scores
          per unit, your study streak, and your weekly goal.
        </li>
        <li>
          <strong>Basic technical data.</strong> Our hosting and database providers keep
          standard server logs (such as IP address, browser type, and request times) to run
          and secure the service.
        </li>
      </ul>
      <p>
        Please don&apos;t put sensitive personal information (home address, phone number,
        health details, passwords, and so on) into chats or images. The tutor doesn&apos;t
        need it.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the tutor: generating replies, practice questions, and grading.</li>
        <li>To save your chats and progress so you can come back to them on any device.</li>
        <li>
          To keep the service working and to improve it. The developer may review usage,
          including individual chats, to fix problems, check that the tutor is giving good
          guidance, and understand which topics students find hard. Any findings shared outside
          the project (for example, in a Fellowship presentation) are aggregated or anonymized
          so they don&apos;t identify you.
        </li>
      </ul>
      <p>We do not sell your data, use it for advertising, or build marketing profiles.</p>

      <h2>Who we share it with</h2>
      <p>
        Only the service providers that make the app work. Each processes data under its own
        terms and privacy policy:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong>: sign-in, database, and image storage (servers in the
          United States).
        </li>
        <li>
          <strong>Vercel</strong>: hosts the website and runs the app&apos;s server code.
        </li>
        <li>
          <strong>Anthropic</strong> (Claude): receives your messages, images, and quiz answers
          to generate the tutor&apos;s replies and grades. <strong>OpenAI</strong> is used the
          same way only as a backup if Anthropic is unavailable.
        </li>
        <li>
          <strong>Voyage AI</strong>: receives the text of your latest chat message to find the
          matching parts of your course materials.
        </li>
      </ul>
      <p>
        We may also disclose information if required by law, or to protect the safety of a
        student or others.
      </p>

      <h2>Stored on your device</h2>
      <p>
        The app uses your browser&apos;s local storage to keep you signed in, remember your
        light or dark theme choice, and keep a copy of your progress so the app loads quickly.
        We don&apos;t use advertising or analytics cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Your chats and progress are kept until you delete them or your account is deleted.
        You can delete any chat yourself from <strong>Chats</strong> in the app, which also
        deletes its images. You can delete your whole account and everything in it at any time
        with <strong>Delete account</strong> at the bottom of the app; this takes effect
        immediately. Copies in our providers&apos; routine backups expire on their normal
        schedule. If you can&apos;t sign in, email {mail} from the address you signed up with
        and we&apos;ll delete it within 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>See your chats and progress any time in the app.</li>
        <li>Rename or delete individual chats from the Chats panel.</li>
        <li>Delete your account yourself with Delete account at the bottom of the app.</li>
        <li>Ask for a copy of your data or a correction at {mail}.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS). Database rules ensure each student&apos;s account
        can read only its own chats, images, and progress. No system is perfectly secure, so
        please use a password you don&apos;t use anywhere else.
      </p>

      <h2>Students and age</h2>
      <p>
        Ransom Tutor is meant for high school students. You must be at least {MIN_AGE} to
        create an account. If you are under 18, please make sure a parent or guardian is okay
        with you using it. If we learn that an account belongs to someone under {MIN_AGE}, we
        will delete it. Parents or guardians can contact {mail} with any questions or
        requests.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a meaningful way, we&apos;ll update the date above and ask
        you to review it in the app. See also the <Link href="/terms">Terms of Use</Link>.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests: {mail}</p>
    </LegalPage>
  );
}
