import com.pinterest.ktlint.rule.engine.api.*;
import com.pinterest.ktlint.ruleset.standard.StandardRuleSetProvider;
import java.nio.file.*;
import java.util.*;

/** Scratch verifier: lint and format each file with ktlint's standard rules and the .editorconfig above it. */
public class KtlintCheck {
    public static void main(String[] args) throws Exception {
        var engine = new KtLintRuleEngine(
            new StandardRuleSetProvider().getRuleProviders(),
            EditorConfigDefaults.Companion.getEMPTY_EDITOR_CONFIG_DEFAULTS(),
            EditorConfigOverride.Companion.getEMPTY_EDITOR_CONFIG_OVERRIDE(),
            false, FileSystems.getDefault());
        int bad = 0;
        for (String f : args) {
            var path = Path.of(f);
            var code = Code.Companion.fromPath(path);
            List<String> errors = new ArrayList<>();
            engine.lint(code, e -> { errors.add(f + ":" + e.getLine() + ":" + e.getCol() + " " + e.getRuleId().getValue() + " " + e.getDetail()); return kotlin.Unit.INSTANCE; });
            String formatted = engine.format(code, (e, c) -> kotlin.Unit.INSTANCE);
            String original = Files.readString(path);
            for (String e : errors) System.out.println("LINT " + e);
            if (!formatted.equals(original)) {
                Files.writeString(Path.of(f + ".formatted"), formatted);
                System.out.println("FORMAT-CHANGES " + f);
            }
            if (!errors.isEmpty() || !formatted.equals(original)) bad++;
            else System.out.println("CLEAN " + f);
        }
        System.exit(bad == 0 ? 0 : 1);
    }
}
