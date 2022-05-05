import { join } from 'path'
import { ExtensionContext, commands } from 'vscode'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, VersionedTextDocumentIdentifier } from 'vscode-languageclient'






async function hello(client: LanguageClient | undefined, context: ExtensionContext): Promise<void> {

  if (client != undefined) 
      client.sendRequest("custom/data", "foo").then(data => console.log(data))

}




export function activate(context: ExtensionContext): void {




  const locale = JSON.parse(process.env['VSCODE_NLS_CONFIG'] ?? '{}')

  const initializationOptions: object = { locale: locale.locale ?? 'en-us' }

  console.log('[HOCON Colorizer Language Client] Options: ' + JSON.stringify(initializationOptions))

  const serverModule = context.asAbsolutePath(join('out','src', 'server', 'hocon.extension.js'))

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      },
    }
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'hocon' }], initializationOptions
  }

  const client = new LanguageClient('hoconLanguageClient','hoconLanguageClient', serverOptions, clientOptions)



  client.registerProposedFeatures()

  client.start()

  context.subscriptions.push(commands.registerTextEditorCommand('vscode_rdd.ast',
  async (editor, _edit) => {
    const converter = client.code2ProtocolConverter;
    const item =
        await client.sendRequest("custom/ast", {
          textDocument:
              converter.asTextDocumentIdentifier(editor.document),
          range: converter.asRange(editor.selection),
        });

  })
  ,commands.registerCommand("vscode_rdd.test", async () => hello(client, context)))




}


export function deactivate(): Promise<void> | undefined {
  return 
}
