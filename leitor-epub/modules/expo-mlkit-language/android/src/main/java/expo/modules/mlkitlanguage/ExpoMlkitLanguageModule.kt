package expo.modules.mlkitlanguage

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoMlkitLanguageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMlkitLanguage")

    AsyncFunction("identifyLanguage") { text: String, promise: Promise ->
      val identifier = LanguageIdentification.getClient()
      identifier.identifyLanguage(text)
        .addOnSuccessListener { language ->
          identifier.close()
          promise.resolve(language)
        }
        .addOnFailureListener { error ->
          identifier.close()
          promise.reject("ERR_LANGUAGE_IDENTIFICATION", error.message, error)
        }
    }

    AsyncFunction("translate") {
      text: String,
      sourceTag: String,
      targetTag: String,
      wifiOnly: Boolean,
      promise: Promise ->
      val source = TranslateLanguage.fromLanguageTag(sourceTag)
      val target = TranslateLanguage.fromLanguageTag(targetTag)
      if (source == null || target == null) {
        promise.reject("ERR_UNSUPPORTED_LANGUAGE", "Idioma não compatível com a tradução local.", null)
        return@AsyncFunction
      }

      val options = TranslatorOptions.Builder()
        .setSourceLanguage(source)
        .setTargetLanguage(target)
        .build()
      val translator = Translation.getClient(options)
      val conditionsBuilder = DownloadConditions.Builder()
      if (wifiOnly) conditionsBuilder.requireWifi()

      translator.downloadModelIfNeeded(conditionsBuilder.build())
        .continueWithTask { translator.translate(text) }
        .addOnSuccessListener { translated ->
          translator.close()
          promise.resolve(translated)
        }
        .addOnFailureListener { error ->
          translator.close()
          promise.reject("ERR_TRANSLATION", error.message, error)
        }
    }

    AsyncFunction("getDownloadedModels") { promise: Promise ->
      RemoteModelManager.getInstance()
        .getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models -> promise.resolve(models.map { it.language }.sorted()) }
        .addOnFailureListener { error ->
          promise.reject("ERR_LIST_MODELS", error.message, error)
        }
    }

    AsyncFunction("deleteModel") { languageTag: String, promise: Promise ->
      val language = TranslateLanguage.fromLanguageTag(languageTag)
      if (language == null) {
        promise.reject("ERR_UNSUPPORTED_LANGUAGE", "Idioma não compatível.", null)
        return@AsyncFunction
      }
      val model = TranslateRemoteModel.Builder(language).build()
      RemoteModelManager.getInstance().deleteDownloadedModel(model)
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error -> promise.reject("ERR_DELETE_MODEL", error.message, error) }
    }
  }
}
