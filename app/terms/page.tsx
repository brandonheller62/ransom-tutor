import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../LegalPage";
import { LEGAL_CONTACT_EMAIL, MIN_AGE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use · Ransom Tutor",
  description: "The rules for using Ransom Tutor, an AI study tool.",
};

export default function TermsPage() {
  const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>;
  return (
    <LegalPage title="Terms of Use" other={{ href: "/privacy", label: "Privacy Policy" }}>
      <p>
        These terms cover your use of Ransom Tutor, an AI study tool built as a student project
        for the AI Innovation Fellowship at Ransom Everglades School. By creating an account or
        using the app, you agree to them. Ransom Tutor is run by its student developer and is
        not an official service of Ransom Everglades School.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be at least {MIN_AGE} years old. If you are under 18, you should have a parent
        or guardian&apos;s permission. Keep your password private; you&apos;re responsible for
        activity on your account.
      </p>

      <h2>The AI can be wrong</h2>
      <p>
        Ransom Tutor uses AI models to guide you, write practice questions, and grade
        answers. AI can make mistakes, including in math, facts, and grading. Check important
        work against your notes, textbook, and teacher. Quiz grades and mastery scores in this
        app are practice feedback only. They are not your course grades.
      </p>

      <h2>Academic integrity</h2>
      <p>
        The tutor is designed to help you learn, mostly with hints rather than answers. Follow
        your school&apos;s honor code and your teacher&apos;s AI policy for each assignment
        (including the Red / Yellow / Green AI levels in your syllabus). Don&apos;t use the app
        to get answers for graded work where AI help isn&apos;t allowed.
      </p>

      <h2>Acceptable use</h2>
      <p>Please don&apos;t:</p>
      <ul>
        <li>Upload anything illegal, harassing, explicit, or that you don&apos;t have the right to share.</li>
        <li>Share other people&apos;s personal information, or sensitive information about yourself.</li>
        <li>Try to break, overload, or get around the app&apos;s security, or access another student&apos;s account.</li>
        <li>Use automated tools to send large numbers of requests, or use the app for anything other than studying.</li>
      </ul>
      <p>We may suspend or delete accounts that break these rules.</p>

      <h2>Your content</h2>
      <p>
        What you write and upload stays yours. You give us permission to store and process it
        to run the app as described in the <Link href="/privacy">Privacy Policy</Link>, which
        includes sending it to our AI providers to generate responses. Course materials used by
        the tutor belong to their authors and the school.
      </p>

      <h2>No guarantees</h2>
      <p>
        Ransom Tutor is a free student project provided &ldquo;as is.&rdquo; It may change,
        have downtime, or be discontinued, and saved data could be lost. To the extent the law
        allows, the developer is not liable for any damages from using it, including relying
        on its answers or grades.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is meaningful, we&apos;ll update the date above
        and ask you to review it. Continuing to use the app after that means you accept the new
        terms.
      </p>

      <h2>Contact</h2>
      <p>Questions: {mail}</p>
    </LegalPage>
  );
}
