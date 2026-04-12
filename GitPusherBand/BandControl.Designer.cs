namespace GitPusherBand
{
    partial class BandControl
    {
        private System.ComponentModel.IContainer components = null;
        private System.Windows.Forms.PictureBox folderIconPictureBox;
        private System.Windows.Forms.Label projectNameLabel;
        private System.Windows.Forms.Panel separatorPanel;
        private System.Windows.Forms.Panel inputBorderPanel;
        private System.Windows.Forms.TextBox featureTextBox;
        private System.Windows.Forms.ContextMenuStrip projectContextMenu;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.projectContextMenu = new System.Windows.Forms.ContextMenuStrip(this.components);
            this.folderIconPictureBox = new System.Windows.Forms.PictureBox();
            this.projectNameLabel = new System.Windows.Forms.Label();
            this.separatorPanel = new System.Windows.Forms.Panel();
            this.inputBorderPanel = new System.Windows.Forms.Panel();
            this.featureTextBox = new System.Windows.Forms.TextBox();
            ((System.ComponentModel.ISupportInitialize)(this.folderIconPictureBox)).BeginInit();
            this.inputBorderPanel.SuspendLayout();
            this.SuspendLayout();
            // 
            // projectContextMenu
            // 
            this.projectContextMenu.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(26)))), ((int)(((byte)(26)))), ((int)(((byte)(26)))));
            this.projectContextMenu.ForeColor = System.Drawing.Color.White;
            this.projectContextMenu.Name = "projectContextMenu";
            this.projectContextMenu.ShowImageMargin = false;
            this.projectContextMenu.Size = new System.Drawing.Size(36, 4);
            // 
            // folderIconPictureBox
            // 
            this.folderIconPictureBox.Location = new System.Drawing.Point(6, 6);
            this.folderIconPictureBox.Name = "folderIconPictureBox";
            this.folderIconPictureBox.Size = new System.Drawing.Size(16, 16);
            this.folderIconPictureBox.SizeMode = System.Windows.Forms.PictureBoxSizeMode.CenterImage;
            this.folderIconPictureBox.TabIndex = 0;
            this.folderIconPictureBox.TabStop = false;
            // 
            // projectNameLabel
            // 
            this.projectNameLabel.AutoEllipsis = true;
            this.projectNameLabel.Cursor = System.Windows.Forms.Cursors.Hand;
            this.projectNameLabel.ForeColor = System.Drawing.Color.White;
            this.projectNameLabel.Location = new System.Drawing.Point(28, 5);
            this.projectNameLabel.Name = "projectNameLabel";
            this.projectNameLabel.Size = new System.Drawing.Size(150, 18);
            this.projectNameLabel.TabIndex = 1;
            this.projectNameLabel.Text = "No projects \u25BE";
            this.projectNameLabel.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            this.projectNameLabel.Click += new System.EventHandler(this.ProjectNameLabel_Click);
            // 
            // separatorPanel
            // 
            this.separatorPanel.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(64)))), ((int)(((byte)(64)))), ((int)(((byte)(64)))));
            this.separatorPanel.Location = new System.Drawing.Point(184, 4);
            this.separatorPanel.Name = "separatorPanel";
            this.separatorPanel.Size = new System.Drawing.Size(1, 20);
            this.separatorPanel.TabIndex = 2;
            // 
            // inputBorderPanel
            // 
            this.inputBorderPanel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left)
            | System.Windows.Forms.AnchorStyles.Right)));
            this.inputBorderPanel.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(26)))), ((int)(((byte)(26)))), ((int)(((byte)(26)))));
            this.inputBorderPanel.Controls.Add(this.featureTextBox);
            this.inputBorderPanel.Location = new System.Drawing.Point(192, 3);
            this.inputBorderPanel.Name = "inputBorderPanel";
            this.inputBorderPanel.Padding = new System.Windows.Forms.Padding(1);
            this.inputBorderPanel.Size = new System.Drawing.Size(222, 22);
            this.inputBorderPanel.TabIndex = 3;
            // 
            // featureTextBox
            // 
            this.featureTextBox.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(26)))), ((int)(((byte)(26)))), ((int)(((byte)(26)))));
            this.featureTextBox.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.featureTextBox.Dock = System.Windows.Forms.DockStyle.Fill;
            this.featureTextBox.ForeColor = System.Drawing.Color.White;
            this.featureTextBox.Location = new System.Drawing.Point(1, 1);
            this.featureTextBox.Name = "featureTextBox";
            this.featureTextBox.Size = new System.Drawing.Size(220, 16);
            this.featureTextBox.TabIndex = 0;
            this.featureTextBox.KeyDown += new System.Windows.Forms.KeyEventHandler(this.FeatureTextBox_KeyDown);
            // 
            // BandControl
            // 
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.None;
            this.BackColor = System.Drawing.Color.FromArgb(((int)(((byte)(26)))), ((int)(((byte)(26)))), ((int)(((byte)(26)))));
            this.Controls.Add(this.inputBorderPanel);
            this.Controls.Add(this.separatorPanel);
            this.Controls.Add(this.projectNameLabel);
            this.Controls.Add(this.folderIconPictureBox);
            this.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.ForeColor = System.Drawing.Color.White;
            this.Margin = new System.Windows.Forms.Padding(0);
            this.MinimumSize = new System.Drawing.Size(420, 28);
            this.Name = "BandControl";
            this.Size = new System.Drawing.Size(420, 28);
            ((System.ComponentModel.ISupportInitialize)(this.folderIconPictureBox)).EndInit();
            this.inputBorderPanel.ResumeLayout(false);
            this.inputBorderPanel.PerformLayout();
            this.ResumeLayout(false);

        }
    }
}
