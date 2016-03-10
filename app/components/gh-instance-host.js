import Ember from 'ember';

const {Component} = Ember;

/**
 * The instance host component contains a webview, displaying a Ghost blog
 * inside an isolated container without Node integration.
 */
export default Component.extend({
    classNames: ['instance-host'],
    classNameBindings: ['blog.isSelected:selected'],

    didReceiveAttrs() {
        this._super(...arguments);
        this.set('isInstanceLoaded', false);
    },

    didRender() {
        this._super(...arguments);

        // Once the webview is created, we immediatly attach handlers
        // to handle the successful load of the content - and a
        // "new window" request coming from the instance
        this.$('webview')
            .off('did-finish-load')
            .on('did-finish-load', () => this._handleLoaded())
            .off('new-window')
            .on('new-window', (e) => this._handleNewWindow(e))
            .off('console-message')
            .on('console-message', (e) => this._handleConsole(e));
    },

    /**
     * Makes the instance visible, overlaying the loading cat in the process
     */
    show() {
        // Fun fact: Chrome's loading apis will consider the website loaded as
        // soon as all assets are loaded. The app however still has to boot up.
        // To make things "feel" more snappy, we're hiding the loading from the
        // user.

        this.set('isInstanceLoaded', true);
    },

    /**
     * Programmatically attempt to login
     */
    signin() {
        let $webviews = this.$('webview');
        let username = this.get('blog.identification');
        let password = this.get('blog').getPassword();

        // If we can't find username or password, bail out and let the
        // user deal with whatever happened
        //
        // TODO: Ask the user for credentials and add them back to the OS
        // keystore
        if (!username || !password || !$webviews || !$webviews[0]) {
            return this.show();
        }

        let commands = [
            `$('input[name="identification"]').val('${username}');`,
            `$('input[name="password"]').val('${password}');`,
            `$('button.login').click();`
        ];

        // Execute the commands. Once done, the load handler will
        // be called again, and the instance set to loaded.
        $webviews[0].executeJavaScript(commands.join(''));
        this.set('isAttemptedSignin', true);
    },

    /**
     * Handle's the 'did-finish-load' event on the webview hosting the Ghost blog
     */
    _handleLoaded() {
        let $webviews = this.$('webview');
        let title = ($webviews && $webviews[0]) ? $webviews[0].getTitle() : '';

        // Check if we're on the sign in page, and if so, attempt to
        // login automatically (without bothering the user)
        if (title.includes('Sign In') && !this.get('isAttemptedSignin')) {
            this.signin();
        }
    },

    /**
     * Handles "new window" requests from the Ghost blog, piping them
     * through to the operating system's default browser
     * @param  {Object} e - jQuery Event
     */
    _handleNewWindow(e) {
        if (e && e.originalEvent && e.originalEvent.url) {
            requireNode('electron').shell.openExternal(e.originalEvent.url);
        }
    },

    /**
     * Handles console messages logged in the webview
     * @param  {Object} e - jQuery Event
     */
    _handleConsole(e) {
        if (e.originalEvent.message.includes('login-error')) {
            let errorNotify = new Notification('Login failed: Please update your credentials.');

            // TODO: Show "update credentials screen here"
            return this.set('isInstanceLoaded', true);
        }

        if (e.originalEvent.message.includes('loaded')) {
            this.set('isInstanceLoaded', true);
        }
    }
});